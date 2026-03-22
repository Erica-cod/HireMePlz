#!/bin/bash
#
# HireMePlz - Single-node k3s deployment script
# For DigitalOcean Droplet (Ubuntu 22.04+, 4GB RAM / 2 vCPU recommended)
#
# Usage:
#   scp -r k8s/ scripts/ root@YOUR_SERVER_IP:~/hiremeplz/
#   ssh root@YOUR_SERVER_IP
#   cd ~/hiremeplz
#   chmod +x scripts/deploy-k3s.sh
#   DOMAIN=hiremeplz.yourdomain.com \
#   API_DOMAIN=api.hiremeplz.yourdomain.com \
#   EMAIL=you@example.com \
#   GHCR_USER=your-github-username \
#   GHCR_TOKEN=ghp_xxxxxxxxxxxx \
#   POSTGRES_PASSWORD=your-secure-password \
#   JWT_SECRET=your-jwt-secret \
#   bash scripts/deploy-k3s.sh

set -euo pipefail

# ---------- Colored output ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }

# ---------- Parameter validation ----------
: "${DOMAIN:?DOMAIN is required (e.g. hiremeplz.yourdomain.com)}"
: "${API_DOMAIN:?API_DOMAIN is required (e.g. api.hiremeplz.yourdomain.com)}"
: "${EMAIL:?EMAIL is required (for Let's Encrypt certificate)}"
: "${GHCR_USER:?GHCR_USER is required (GitHub username)}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required (GitHub PAT with packages:read)}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
JSEARCH_API_KEY="${JSEARCH_API_KEY:-}"
ADZUNA_APP_ID="${ADZUNA_APP_ID:-}"
ADZUNA_APP_KEY="${ADZUNA_APP_KEY:-}"
SENDGRID_API_KEY="${SENDGRID_API_KEY:-}"
DO_SPACES_KEY="${DO_SPACES_KEY:-}"
DO_SPACES_SECRET="${DO_SPACES_SECRET:-}"
DO_SPACES_BUCKET="${DO_SPACES_BUCKET:-}"
DO_SPACES_REGION="${DO_SPACES_REGION:-tor1}"

SERVER_IP=$(curl -s ifconfig.me)
info "Server public IP: $SERVER_IP"

# ========================================
# Step 1: Install k3s
# ========================================
info "=== Step 1: Install k3s (disable Traefik, will use nginx-ingress) ==="

if command -v k3s &> /dev/null; then
  info "k3s already installed, skipping"
else
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable=traefik" sh -
  info "Waiting for k3s to be ready..."
  sleep 10
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

until kubectl get nodes 2>/dev/null | grep -q " Ready"; do
  info "Waiting for node to be Ready..."
  sleep 3
done
info "k3s node is ready"

# ========================================
# Step 2: Install NGINX Ingress Controller
# ========================================
info "=== Step 2: Install NGINX Ingress Controller ==="

if kubectl get namespace ingress-nginx &> /dev/null; then
  info "ingress-nginx already exists, skipping"
else
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/baremetal/deploy.yaml

  info "Waiting for ingress-nginx to be ready..."
  kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=180s
fi

# Single-node bare-metal: patch ingress-nginx to use NodePort on 80/443
kubectl -n ingress-nginx patch svc ingress-nginx-controller \
  --type='json' \
  -p='[
    {"op":"replace","path":"/spec/type","value":"NodePort"},
    {"op":"replace","path":"/spec/ports/0/nodePort","value":80},
    {"op":"replace","path":"/spec/ports/1/nodePort","value":443}
  ]' 2>/dev/null || true

info "NGINX Ingress Controller is ready"

# ========================================
# Step 3: Install cert-manager (auto TLS)
# ========================================
info "=== Step 3: Install cert-manager ==="

if kubectl get namespace cert-manager &> /dev/null; then
  info "cert-manager already exists, skipping"
else
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.3/cert-manager.yaml

  info "Waiting for cert-manager to be ready..."
  kubectl wait --namespace cert-manager \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/instance=cert-manager \
    --timeout=180s
fi

cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

info "cert-manager + Let's Encrypt ClusterIssuer ready"

# ========================================
# Step 4: Create namespace and secrets
# ========================================
info "=== Step 4: Create namespace and image pull secret ==="

kubectl create namespace hiremeplz --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret docker-registry ghcr-secret \
  --namespace=hiremeplz \
  --docker-server=ghcr.io \
  --docker-username="$GHCR_USER" \
  --docker-password="$GHCR_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

info "GHCR image pull secret created"

# ========================================
# Step 5: Substitute placeholders in config
# ========================================
info "=== Step 5: Configure domains and secrets ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
K8S_DIR="$(cd "$SCRIPT_DIR/../k8s" && pwd)"

# Replace Ingress domain names
GRAFANA_DOMAIN="${GRAFANA_DOMAIN:-grafana.${DOMAIN}}"
sed -i "s|hiremeplz.example.com|${DOMAIN}|g" "$K8S_DIR/ingress.yaml"
sed -i "s|api.hiremeplz.example.com|${API_DOMAIN}|g" "$K8S_DIR/ingress.yaml"
sed -i "s|grafana.hiremeplz.example.com|${GRAFANA_DOMAIN}|g" "$K8S_DIR/ingress.yaml"

# Replace ConfigMap API URL
sed -i "s|https://api.hiremeplz.example.com|https://${API_DOMAIN}|g" "$K8S_DIR/configmap.yaml"

# Replace Secret placeholder values
sed -i "s|replace-me-postgres-password|${POSTGRES_PASSWORD}|g" "$K8S_DIR/secret.yaml"
sed -i "s|replace-me-jwt-secret-at-least-8-chars|${JWT_SECRET}|g" "$K8S_DIR/secret.yaml"

if [ -n "$OPENAI_API_KEY" ]; then
  sed -i "s|OPENAI_API_KEY: \"\"|OPENAI_API_KEY: \"${OPENAI_API_KEY}\"|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$JSEARCH_API_KEY" ]; then
  sed -i "s|JSEARCH_API_KEY: \"\"|JSEARCH_API_KEY: \"${JSEARCH_API_KEY}\"|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$ADZUNA_APP_ID" ]; then
  sed -i "s|ADZUNA_APP_ID: \"\"|ADZUNA_APP_ID: \"${ADZUNA_APP_ID}\"|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$ADZUNA_APP_KEY" ]; then
  sed -i "s|ADZUNA_APP_KEY: \"\"|ADZUNA_APP_KEY: \"${ADZUNA_APP_KEY}\"|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$SENDGRID_API_KEY" ]; then
  sed -i "s|SENDGRID_API_KEY: \"\"|SENDGRID_API_KEY: \"${SENDGRID_API_KEY}\"|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$DO_SPACES_KEY" ]; then
  sed -i "s|replace-me-spaces-access-key|${DO_SPACES_KEY}|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$DO_SPACES_SECRET" ]; then
  sed -i "s|replace-me-spaces-secret-key|${DO_SPACES_SECRET}|g" "$K8S_DIR/secret.yaml"
fi
if [ -n "$DO_SPACES_BUCKET" ]; then
  sed -i "s|replace-me-bucket-name|${DO_SPACES_BUCKET}|g" "$K8S_DIR/secret.yaml"
fi
sed -i "s|DO_SPACES_REGION: \"nyc3\"|DO_SPACES_REGION: \"${DO_SPACES_REGION}\"|g" "$K8S_DIR/secret.yaml"

info "Configuration updated with actual values"

# ========================================
# Step 6: Deploy application
# ========================================
info "=== Step 6: Deploy HireMePlz to k8s ==="

kubectl apply -k "$K8S_DIR"

info "Waiting for all pods to be ready (up to 5 minutes)..."
kubectl wait --namespace hiremeplz \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=postgres \
  --timeout=120s

kubectl wait --namespace hiremeplz \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=redis \
  --timeout=60s

kubectl wait --namespace hiremeplz \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=backend \
  --timeout=180s

kubectl wait --namespace hiremeplz \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=frontend \
  --timeout=120s

kubectl wait --namespace hiremeplz \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=prometheus \
  --timeout=120s

kubectl wait --namespace hiremeplz \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=grafana \
  --timeout=120s

# ========================================
# Done
# ========================================
echo ""
echo "=============================================="
info "HireMePlz deployment complete!"
echo "=============================================="
echo ""
kubectl get all -n hiremeplz
echo ""
echo "----------------------------------------------"
echo "Configure DNS (A records):"
echo "  ${DOMAIN}            -> ${SERVER_IP}"
echo "  ${API_DOMAIN}        -> ${SERVER_IP}"
echo "  ${GRAFANA_DOMAIN}    -> ${SERVER_IP}  (Grafana dashboard)"
echo ""
echo "TLS certificates will be auto-provisioned by cert-manager once DNS propagates."
echo "----------------------------------------------"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n hiremeplz              # View pod status"
echo "  kubectl logs -n hiremeplz -l app.kubernetes.io/name=backend  # View backend logs"
echo "  kubectl get hpa -n hiremeplz               # View autoscaler status"
echo "  kubectl get networkpolicy -n hiremeplz     # View network policies"
echo "  kubectl get certificate -n hiremeplz       # View TLS certificate status"
echo "  kubectl top pods -n hiremeplz              # View resource usage (requires metrics-server)"
echo ""

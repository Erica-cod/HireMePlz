# HireMePlz Deployment Guide

## Local Development

1. Copy `.env.example` to `.env`
2. Run `npm install --include=dev`
3. Start PostgreSQL, or run `docker compose up postgres -d`
4. Run `npm run db:generate` and `npm run db:push`
5. Start services separately:
   - `npm run dev:backend`
   - `npm run dev:frontend`
   - `npm run dev:worker`
6. Build extension with `npm run build --workspace extension`, then load `extension` in Chrome

## Docker Compose

```bash
docker compose up --build
```

Default service ports:

- Frontend: `3000`
- Backend: `4000`
- Database: `5432`

---

## Kubernetes Deployment (Recommended for Production)

This project uses **k3s** (lightweight Kubernetes) + **Kustomize** to run all services on a single DigitalOcean Droplet.

### Architecture Overview

```
                        ┌──────────────────────────────────┐
                        │       DigitalOcean Droplet       │
                        │        (k3s single node)         │
Internet ──► DNS ──►    │                                  │
                        │  ┌─────────────────────────────┐ │
                        │  │   NGINX Ingress Controller   │ │
                        │  │   + cert-manager (TLS)       │ │
                        │  └──────┬──────────┬────────────┘ │
                        │         │          │              │
                        │    ┌────▼──┐  ┌────▼────┐        │
                        │    │Frontend│  │ Backend │ ←─ HPA │
                        │    │(Next.js│  │(Express)│(2~5)   │
                        │    │ x2)   │  └────┬────┘        │
                        │    └───────┘       │              │
                        │         ┌──────────┼──────────┐   │
                        │         │          │          │   │
                        │    ┌────▼──┐  ┌────▼───┐ ┌────▼─┐│
                        │    │Worker │  │Worker  │ │Redis ││
                        │    │(Scraper│  │ LLM   │ │      ││
                        │    │)      │  │ ←─ HPA │ │      ││
                        │    └───────┘  └────────┘ └──────┘│
                        │         │          │              │
                        │    ┌────▼──────────▼────────┐    │
                        │    │  PostgreSQL (StatefulSet) │    │
                        │    │   5Gi PersistentVolume    │    │
                        │    └──────────────────────────┘    │
                        └──────────────────────────────────┘
```

### K8s Features Used

| Feature | File | Description |
|---------|------|-------------|
| **Kustomize** | `k8s/kustomization.yaml` | Declarative config management, deploys all resources in one command |
| **Namespace** | `k8s/namespace.yaml` | `hiremeplz` namespace isolation |
| **StatefulSet** | `k8s/postgres/statefulset.yaml` | PostgreSQL stateful workload with PVC persistent storage |
| **Deployment** | `k8s/backend/`, `frontend/`, etc. | Stateless service declarative deployments |
| **HPA** | `k8s/hpa.yaml` | backend (2→5) and worker-llm (1→3) auto-scale based on CPU utilization |
| **NetworkPolicy** | `k8s/network-policy.yaml` | Default-deny + whitelist; database only accessible from backend |
| **PDB** | `k8s/pdb.yaml` | Ensures at least 1 pod of frontend/backend remains available during updates |
| **ResourceQuota** | `k8s/resource-quota.yaml` | Namespace-level resource limits to prevent resource exhaustion |
| **Rolling Update** | All Deployments | `maxSurge: 1, maxUnavailable: 0` for zero-downtime deployments |
| **Health Probes** | All Deployments | Readiness + liveness probes for auto-removal/restart of unhealthy pods |
| **Ingress + TLS** | `k8s/ingress.yaml` | NGINX Ingress + cert-manager for automatic Let's Encrypt certificates |
| **ConfigMap/Secret** | `k8s/configmap.yaml`, `secret.yaml` | Separation of config from code; sensitive data managed independently |
| **InitContainer** | `k8s/backend/deployment.yaml` | Runs database migration before the main container starts |

### Why Kubernetes Fits This Project

1. **Microservices + heterogeneous workloads**: 6 independent services (Node.js API, Next.js SSR, Python scraper, LLM calls) each requiring independent scaling and resource allocation
2. **Elastic scaling**: Traffic spikes when users batch-submit applications (backend); burst load when multiple users trigger resume analysis (worker-llm) — HPA handles this automatically
3. **Zero-downtime updates**: RollingUpdate + PDB ensures users experience no interruption during deployments
4. **Network security**: NetworkPolicy ensures databases/Redis are not exposed to unnecessary services
5. **Self-healing**: Crashed pods auto-restart; failed health probes automatically remove traffic from unhealthy instances
6. **Stateful management**: PostgreSQL uses StatefulSet + PVC for durable, persistent storage

### Prerequisites

- DigitalOcean Droplet: **4GB RAM / 2 vCPU** ($24/mo) or higher recommended
- OS: Ubuntu 22.04 LTS
- Domain: Two A records pointing to the Droplet IP
- GitHub Container Registry: Images are automatically built and pushed via CI

### One-Command Deployment

1. **Ensure CI has built the images**

   Push code to the `main` branch and GitHub Actions will automatically build and push 4 images to GHCR.

2. **Create a DigitalOcean Droplet**

   ```bash
   # Recommended: Ubuntu 22.04, 4GB RAM, 2 vCPU, SFO3 region
   ```

3. **Upload files to the server**

   ```bash
   scp -r k8s/ scripts/ root@YOUR_SERVER_IP:~/hiremeplz/
   ```

4. **SSH in and run the deploy script**

   ```bash
   ssh root@YOUR_SERVER_IP
   cd ~/hiremeplz

   DOMAIN=hiremeplz.yourdomain.com \
   API_DOMAIN=api.hiremeplz.yourdomain.com \
   EMAIL=you@example.com \
   GHCR_USER=your-github-username \
   GHCR_TOKEN=ghp_xxxxxxxxxxxx \
   POSTGRES_PASSWORD=your-secure-password \
   JWT_SECRET=your-jwt-secret-at-least-8-chars \
   OPENAI_API_KEY=sk-xxxx \
   bash scripts/deploy-k3s.sh
   ```

5. **Configure DNS**

   Add A records at your domain registrar:
   ```
   hiremeplz.yourdomain.com      → YOUR_SERVER_IP
   api.hiremeplz.yourdomain.com  → YOUR_SERVER_IP
   ```

   Once DNS propagates, cert-manager will automatically provision TLS certificates.

### Post-Deployment Operations

```bash
# View all resources
kubectl get all -n hiremeplz

# View pod status
kubectl get pods -n hiremeplz -o wide

# View autoscaler status
kubectl get hpa -n hiremeplz

# View TLS certificate status
kubectl get certificate -n hiremeplz

# View network policies
kubectl get networkpolicy -n hiremeplz

# View resource usage
kubectl top pods -n hiremeplz

# View backend logs
kubectl logs -n hiremeplz -l app.kubernetes.io/name=backend --tail=100

# Manual scaling
kubectl scale deployment backend -n hiremeplz --replicas=3

# Rolling restart (pull latest images)
kubectl rollout restart deployment backend -n hiremeplz
kubectl rollout restart deployment frontend -n hiremeplz

# View rollout status
kubectl rollout status deployment backend -n hiremeplz
```

### Updating the Application

Push code to `main` → CI builds new images → on the server:

```bash
kubectl rollout restart deployment backend frontend worker worker-llm -n hiremeplz
```

K8s will progressively replace pods using the RollingUpdate strategy with zero downtime.

---

## Docker Swarm (Alternative)

This repo includes [swarm-stack.yml](../deploy/swarm-stack.yml). Before production deployment:

1. Push all images to your image registry
2. Prepare environment variables on the server
3. Initialize Swarm: `docker swarm init`
4. Deploy stack:

```bash
docker stack deploy -c deploy/swarm-stack.yml hiremeplz
```

## Monitoring Recommendations

- Minimum setup: enable DigitalOcean CPU, memory, disk, and container restart alerts
- Backend exposes `/api/health` for probe checks
- For extended monitoring, integrate Prometheus + Grafana or use cloud-native monitoring

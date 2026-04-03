# AI Interaction Records

This document records three representative AI interactions that meaningfully influenced the development of **HireMePlz**. Each entry demonstrates how AI tools (ChatGPT, GitHub Copilot) were used responsibly, how outputs were critically evaluated, and how suggestions were validated or corrected.

All prompts in this document follow the **Goal → Context → Constraints → Done When** structured prompt template, a best practice widely recommended in the AI-assisted software engineering community. Anthropic's Claude prompt engineering guide advocates "stating the goal + constraints upfront and defining what 'done' looks like" as a core principle ([Prompt engineering best practices | Claude](https://www.claude.com/blog/best-practices-for-prompt-engineering)), and Cursor IDE's official agent best practices similarly recommend structuring prompts with explicit Goal, Context, Constraints, and Definition of Done to reduce hallucination and make agent behavior more predictable ([Best practices for coding with agents · Cursor](https://cursor.com/blog/agent-best-practices)). This four-part structure treats each prompt as a lightweight specification rather than a vague request, ensuring the AI has clear boundaries and measurable acceptance criteria.

---

## Session 1: Debugging TLS Certificate Failures on DigitalOcean Kubernetes

### Prompt (sent to ChatGPT)

```
Goal: Diagnose why TLS certificates are stuck in "Not Ready" state on my DigitalOcean
Kubernetes cluster and get HTTPS working for all three domains.

Context: I deployed HireMePlz to DigitalOcean Managed Kubernetes. The stack includes
Nginx Ingress Controller and cert-manager with a Let's Encrypt ClusterIssuer (HTTP-01
solver). Three domains are configured: hiremeplz.info (frontend), api.hiremeplz.info
(backend), grafana.hiremeplz.info (Grafana). We also have a default-deny NetworkPolicy
applied to the hiremeplz namespace with explicit per-service allow rules. `kubectl
describe certificate` shows the ACME challenge is failing — solver pods are created
but the validation request times out.

Constraints:
- Cannot switch to DNS-01 challenge; must use HTTP-01.
- NetworkPolicies must remain in place (default-deny is a course requirement).
- Cannot expose services without TLS; HTTPS is mandatory for all domains.

Done when: All three certificates show "Ready: True" via `kubectl get certificate`,
and browsers load https://hiremeplz.info, https://api.hiremeplz.info, and
https://grafana.hiremeplz.info with a valid Let's Encrypt certificate.
```

### AI Response (trimmed)

ChatGPT suggested the following troubleshooting steps:

> 1. **Check that your DNS A records point to the Ingress Controller's external IP.** Run `kubectl get svc -n ingress-nginx` to find the LoadBalancer IP, then verify with `nslookup hiremeplz.info`.
>
> 2. **Ensure the Ingress resource has the annotation `cert-manager.io/cluster-issuer: letsencrypt-prod`** so cert-manager knows to manage the certificate.
>
> 3. **Check if the ACME solver pod can receive traffic on port 80.** Let's Encrypt needs to reach `http://yourdomain/.well-known/acme-challenge/<token>`. Make sure your Ingress allows HTTP traffic and doesn't force-redirect to HTTPS before the certificate is issued.
>
> 4. **Verify that the ClusterIssuer is configured correctly:**
>
> ```yaml
> apiVersion: cert-manager.io/v1
> kind: ClusterIssuer
> metadata:
>   name: letsencrypt-prod
> spec:
>   acme:
>     server: https://acme-v02.api.letsencrypt.org/directory
>     email: your-email@example.com
>     privateKeySecretRef:
>       name: letsencrypt-prod
>     solvers:
>       - http01:
>           ingress:
>             class: nginx
> ```
>
> 5. **Check for rate limits.** Let's Encrypt has a rate limit of 5 duplicate certificates per week. If you've been retrying, you may be rate-limited.

### What Our Team Did With It

- **What was useful:** Steps 1 and 2 were good standard checks and helped us confirm the basics were correct — DNS records were pointing to the right LoadBalancer IP, and the Ingress annotations were present. The ClusterIssuer YAML template (step 4) matched our configuration. This gave us confidence to look deeper.

- **What was incorrect or missed the real cause:** The AI did not identify our actual problem, which was a **NetworkPolicy conflict**. We had applied a default-deny NetworkPolicy to the `hiremeplz` namespace. When cert-manager created temporary ACME solver pods to respond to the HTTP-01 challenge, the Nginx Ingress Controller (which runs in the `ingress-nginx` namespace) was blocked from reaching those solver pods because our NetworkPolicy only allowed ingress from pods within the `hiremeplz` namespace. The AI's step 3 mentioned checking "port 80 access" in general terms, but never considered that Kubernetes NetworkPolicy could block cross-namespace traffic to the dynamically-created solver pods. Additionally, the AI's suggestion about Let's Encrypt rate limits (step 5) was a red herring in our case — we had not hit any rate limits, but this sent us on a 30-minute detour checking rate limit status on `https://crt.sh`.

- **How we identified and fixed it:** We ran `kubectl describe challenge` and noticed the solver pod was running but the ACME validation request timed out. We then ran `kubectl exec` from a pod in the `ingress-nginx` namespace and tried to `curl` the solver pod's IP on port 8089 — the connection hung, confirming a network-level block. We added a NetworkPolicy rule allowing ingress from the `ingress-nginx` namespace to pods with the label `acme.cert-manager.io/http01-solver: "true"` on port 8089. After applying this fix, we deleted the pending `CertificateRequest` and the certificates were issued within 2 minutes. We verified by checking `kubectl get certificate` showed `Ready: True` and by visiting `https://hiremeplz.info` in a browser to confirm the valid Let's Encrypt certificate.

---

## Session 2: Designing the GitHub Actions CI/CD Pipeline

### Prompt (sent to ChatGPT)

```
Goal: Create two GitHub Actions workflow files — one for CI (continuous integration) and
one for CD (continuous delivery) — for my TypeScript monorepo.

Context: HireMePlz is a monorepo using npm workspaces with the following packages:
backend (Express.js + Prisma ORM), frontend (Next.js), worker (job scraper), worker-llm
(LLM autofill), and extension (Chrome MV3). The backend depends on PostgreSQL via Prisma.
All services except the extension have a Dockerfile. Docker images should be published to
GitHub Container Registry (GHCR). After images are pushed, Watchtower running in our
DigitalOcean Kubernetes cluster automatically detects new images and performs rolling
restarts — so we only need to build and push, not kubectl apply.

Constraints:
- CI must run on every push to main AND on all pull requests.
- CI must include: dependency install, Prisma client generation, TypeScript type-checking
  (tsc --noEmit) across all workspaces, and a full build of all packages.
- CD must build Docker images for 4 services (backend, frontend, worker, worker-llm) in
  parallel using a matrix strategy.
- Images must be tagged with both :latest and the Git commit SHA for traceability.
- Build time should be optimized with Docker layer caching.

Done when: CI workflow passes on a PR with no false positives, CD workflow pushes all 4
images to GHCR with correct tags, and Watchtower picks up the new images and restarts
pods within 5 minutes of a push to main.
```

### AI Response (trimmed)

**CI workflow (`ci.yml`):**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit
      - run: npm run build
```

**CD workflow (`docker-publish.yml`):**

```yaml
name: Docker Publish
on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [backend, frontend, worker, worker-llm]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./${{ matrix.service }}/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/${{ matrix.service }}:latest
```

### What Our Team Did With It

- **What was useful:** The matrix strategy in the CD workflow was exactly what we needed — building 4 Docker images in parallel with a single job definition is clean and maintainable. The use of `docker/login-action` and `docker/build-push-action` with GHCR was correct. The overall CI workflow structure (checkout → setup-node → install → build) was a solid starting point.

- **What was incorrect or needed significant changes:**  
  (1) The CI workflow was missing a **PostgreSQL service container**. Our `prisma db push` and type-checking require a running database because Prisma validates the schema against an actual PostgreSQL connection. Without it, `prisma generate` may succeed, but any step that touches the database (like seeding or integration smoke tests) would fail. We added a `services:` block with `postgres:16` and set `DATABASE_URL` in the environment.  
  (2) The AI ran `npx tsc --noEmit` as a single global command, but our monorepo has separate `tsconfig.json` files in each workspace. Running `tsc` from the root without specifying a project would fail or only check the root config. We changed it to `npx tsc --noEmit` with the correct `--project` flag for each workspace, or alternatively used our root `package.json` script that handles this.  
  (3) The CD workflow only tagged images as `:latest`, which makes rollback difficult and provides no traceability. We added the Git SHA as a secondary tag (`ghcr.io/.../backend:sha-abc1234`) so every image maps to a specific commit. We also added `docker/metadata-action` to automatically generate tags from Git refs and version tags.  
  (4) The AI did not include **Docker layer caching**. Without it, every CI run would rebuild all layers from scratch, taking 8–10 minutes per image. We added `cache-from: type=gha` and `cache-to: type=gha,mode=max` to `docker/build-push-action`, which uses GitHub Actions' built-in cache backend. This reduced subsequent build times to approximately 2–3 minutes.

- **How we verified:** We pushed the workflows to a feature branch and opened a PR to trigger the CI workflow. The first run failed because of the missing PostgreSQL service — this confirmed the AI's omission. After adding the service container and fixing the TypeScript check commands, CI passed. For CD, we merged to `main` and confirmed on the GitHub Actions log that all 4 matrix jobs completed successfully, images appeared in our GHCR package registry with both `:latest` and `:sha-*` tags, and Watchtower in the cluster detected the new images and performed rolling restarts within 5 minutes. We verified the deployed version by checking the `/health` endpoint which returns the Git SHA.

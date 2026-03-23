# HireMePlz — Presentation Script & Demo Flow

> Total time: **6 minutes** | 1-minute warning hand signal | Hard stop at 6:00

---

## Pre-Presentation Checklist

### Laptop Setup (complete before arriving at classroom)

1. **Browser tabs** (pre-opened and logged in):
   - Tab 1: `presentation.html` (press F11 for fullscreen)
   - Tab 2: `https://hiremeplz.info` — logged in, on Dashboard
   - Tab 3: `https://grafana.hiremeplz.info` — logged in, Overview dashboard open
   - Tab 4: `https://github.com/Erica-cod/HireMePlz/actions` — shows CI/CD history

2. **Terminal window** (pre-opened, SSH'd into server):
   ```bash
   # Test all commands before class
   kubectl get pods -n hiremeplz
   kubectl get deployments -n hiremeplz
   kubectl get pvc -n hiremeplz
   kubectl get hpa -n hiremeplz
   kubectl get ingress -n hiremeplz
   ```

3. **Display**: Mirror mode (not extended), verify projector shows same content

4. **Backup plan** (in case of network issues):
   - Pre-recorded 30s Grafana screencast
   - Screenshots of kubectl output
   - Pre-recorded app walkthrough clip

---

## Time Allocation (9 slides, 6 minutes)

| Time | Slide | Content | Duration |
|------|-------|---------|----------|
| 0:00–0:25 | 1–2 | Title + Project overview | 25s |
| 0:25–0:55 | 3 | System architecture | 30s |
| 0:55–1:35 | 4 | Docker + multi-container + stateful design | 40s |
| 1:35–3:15 | 5 | K8s orchestration + **kubectl terminal demo** | 1m40s |
| 3:15–4:15 | 6 | Monitoring + **Grafana live demo** | 1m |
| 4:15–5:00 | 7 | Advanced features overview | 45s |
| 5:00–5:40 | 8 | CI/CD pipeline detail | 40s |
| 5:40–6:00 | 9 | Summary | 20s |

---

## Speaker Notes (per slide)

### Slide 1: Title (0:00–0:05)

> Hi everyone, we're [Team Name], and today we'll be presenting HireMePlz.

Move to next slide immediately.

---

### Slide 2: Project Overview (0:05–0:25)

> HireMePlz is an AI-powered job application assistant. The core problem we're solving is that job seekers have to repeatedly fill out similar application forms. Our system uses a Chrome extension combined with LLM to intelligently autofill forms based on your profile and story library.
>
> It also supports automated job scraping, matching, and application tracking. Let me walk you through the architecture.

**Key**: Don't explain every feature. One sentence on the purpose, then move on.

---

### Slide 3: System Architecture (0:25–0:55)

> Here's our high-level architecture. At the top, users access the app through the browser or Chrome extension. All traffic goes through an Nginx Ingress Controller with HTTPS via Let's Encrypt.
>
> We have four application services: a Next.js frontend, an Express backend running with 2 replicas, a job scraping worker, and an LLM autofill worker. These communicate through Redis BullMQ queues.
>
> At the data layer, PostgreSQL runs as a StatefulSet with a 5 gig PersistentVolumeClaim. And we have a full monitoring stack with Prometheus, Grafana, Loki, and Promtail.
>
> In total, that's 11 containers deployed on DigitalOcean via Kubernetes.

---

### Slide 4: Docker + Multi-Container + Stateful Design (0:55–1:35)

> For containerization, each of our 11 services has its own Dockerfile. Locally, we use Docker Compose to spin everything up with a single command. Health checks ensure services start in the right order — for example, the backend waits for PostgreSQL and Redis to be ready.
>
> For stateful design — this is how our data survives container restarts. PostgreSQL runs as a StatefulSet with a 5 gig PVC. Even if the pod is deleted and recreated, the data remains on the persistent volume. Redis serves as the message broker for our async task queues. And we have a daily automated backup that dumps the database and uploads it to DigitalOcean Spaces.

**Rubric items covered**: Docker Containerization, Multi-Container Architecture, Stateful Design Explanation

---

### Slide 5: Kubernetes Orchestration (1:35–3:15) — MOST IMPORTANT

**Part A: Explain the slide (~30s)**

> For orchestration, we chose Kubernetes, deployed on DigitalOcean. We use Kustomize to manage all our K8s manifests — namespaces, deployments, services, statefulsets, ingress, HPA, PDB, and network policies.
>
> The backend runs with 2 replicas and a RollingUpdate strategy. Each deployment has an InitContainer that automatically runs database migrations. All pods have readiness and liveness probes, plus defined resource requests and limits.
>
> We use Nginx Ingress to route three domains: hiremeplz.info for the frontend, api.hiremeplz.info for the backend, and grafana.hiremeplz.info for the monitoring dashboard.

**Part B: Switch to terminal for live demo (~1m)**

> Let me switch to the terminal to show you the actual running cluster.

Run commands one by one:

```bash
kubectl get pods -n hiremeplz
```
> "As you can see, all pods are Running. The backend has 2 replicas."

```bash
kubectl get deployments -n hiremeplz
```
> "Here are all deployments with their desired and ready replica counts."

```bash
kubectl get pvc -n hiremeplz
```
> "The PostgreSQL PVC is Bound with 5 gigs of storage."

```bash
kubectl get hpa -n hiremeplz
```
> "Our HPA is configured to scale the backend from 2 to 5 replicas when CPU hits 70%."

Switch back to slides.

**Tips**:
- Pre-type commands or use history (up arrow) for speed
- If kubectl is slow, switch to pre-captured screenshots immediately
- Keep explanations to one sentence per command

---

### Slide 6: Monitoring & Observability (3:15–4:15)

**Part A: Explain the slide (~15s)**

> For monitoring, we built a complete observability stack. Prometheus scrapes custom metrics from the backend's /metrics endpoint. Grafana provides visualization. And Loki plus Promtail handle centralized log aggregation. We also have custom alert rules for CPU, memory, error rates, latency, and queue health.

**Part B: Switch to Grafana live demo (~45s)**

> Let me show you the live Grafana dashboard.

Switch to Tab 3 (grafana.hiremeplz.info) and walk through:

1. **Request rate panel** — "This shows real-time request rates per HTTP status code."
2. **Latency percentiles** — "P50, P90, and P99 latency at a glance."
3. **5xx error rate** — "Green means our error rate is healthy."
4. **Queue status** — "This shows waiting, active, and failed tasks in our BullMQ queues."
5. Scroll to **heap memory** if time permits.

Switch back to slides.

**Tips**:
- Generate some traffic beforehand (visit the app a few times) so the graphs have data
- If Grafana doesn't load, immediately switch to backup recording

---

### Slide 7: Advanced Features (4:15–5:00)

> We implemented 4 advanced features — well above the minimum of 2.
>
> First, **auto-scaling and high availability**. Our HPA automatically scales the backend from 2 to 5 replicas when CPU exceeds 70%. Worker-LLM scales 1 to 3. PodDisruptionBudgets guarantee at least one pod remains available during updates.
>
> Second, **security enhancements**. We use cert-manager with Let's Encrypt for automatic HTTPS. All API endpoints require JWT authentication with bcrypt password hashing. And Kubernetes NetworkPolicies enforce least-privilege network access between services.
>
> Third, **CI/CD pipeline**. And fourth, **automated backup**. I'll go into more detail on the next slide.

---

### Slide 8: CI/CD Pipeline Detail (5:00–5:40)

> Our CI/CD works like this: on every push to main, GitHub Actions runs type checking and builds all packages. Then it matrix-builds 4 Docker images and pushes them to GitHub Container Registry.
>
> On the server side, Watchtower monitors GHCR, detects new images, and automatically restarts the affected containers with a rolling update. So the entire flow from git push to production is fully automated.
>
> For backup, a Kubernetes CronJob runs daily at 2 AM UTC, does a pg_dump, compresses it, and uploads to DigitalOcean Spaces.

**Optional**: Quickly flash Tab 4 to show GitHub Actions run history.

---

### Slide 9: Summary (5:40–6:00)

> To summarize: HireMePlz meets all 6 core technical requirements — Docker containerization, PostgreSQL with persistent storage, Kubernetes orchestration, monitoring with Prometheus and Grafana, 11 containers running together, and a clear stateful design.
>
> We've also implemented 4 advanced features: auto-scaling, security, CI/CD, and automated backups.
>
> The app is live at hiremeplz.info, and all source code is on GitHub. Thank you!

---

## Tab Switching Order

```
Slides (fullscreen) [1–4]
    ↓
Terminal (kubectl commands) [during slide 5]
    ↓
Slides [5 wrap-up]
    ↓
Grafana browser tab [during slide 6]
    ↓
Slides [6 wrap-up → 7 → 8 → 9]
```

## If Running Over Time — Priority Cuts

1. **Cut first**: Slide 8 CI/CD detail (mention it briefly in Slide 7 instead)
2. **Shorten**: Slide 2 project overview (10s max)
3. **Shorten**: kubectl demo (show only pods + pvc, skip hpa/ingress)
4. **Never cut**: Slide 5 K8s demo + Slide 6 Grafana demo (highest rubric weight)

## If Network Is Unreliable — Backup Plan

| Feature | Backup |
|---------|--------|
| kubectl commands | Pre-captured screenshots, open as local images |
| Grafana dashboard | Pre-recorded 30s screen capture, play with live narration |
| App (hiremeplz.info) | Pre-recorded walkthrough video |
| GitHub Actions | Single screenshot of recent runs |

## Pre-Capture Commands (Run Day Before)

SSH into server and save this output:

```bash
echo "=== Pods ===" && kubectl get pods -n hiremeplz && \
echo -e "\n=== Deployments ===" && kubectl get deployments -n hiremeplz && \
echo -e "\n=== PVC ===" && kubectl get pvc -n hiremeplz && \
echo -e "\n=== HPA ===" && kubectl get hpa -n hiremeplz && \
echo -e "\n=== Ingress ===" && kubectl get ingress -n hiremeplz
```

Take screenshots or use `script` to record the terminal session.

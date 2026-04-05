# HireMePlz — AI-Powered Job Application Assistant

## Team Information

| Name | Student Number | Email |
|------|---------------|-------|
| Yushun Tang | *1011561962* | *yushun.tang@mail.utoronto.ca* |
| Keyin Liang | *1005932788* | *keryn.liang@mail.utoronto.ca* |
| Zhengyang Li | *1012373977* | *zhengyang.li@mail.utoronto.ca* |
| Irys Zhang | *1012794424* | *irys.zhang@mail.utoronto.ca* |

> **GitHub Repository:** [github.com/Erica-cod/HireMePlz](https://github.com/Erica-cod/HireMePlz)

---

## Video Demo

*https://youtu.be/c6bGw6RSZ30*

---

## Motivation

Job hunting is one of the most stressful and repetitive tasks for students and early-career professionals. Applicants routinely face the same challenges: filling in identical personal information across dozens of job portals, crafting tailored responses to behavioral questions, and keeping track of which jobs they have applied to. Existing tools like LinkedIn Easy Apply only work within a single platform, and generic form-fillers (e.g., browser autofill) cannot handle open-ended questions or match a candidate's personal stories to specific prompts.

**HireMePlz** addresses this gap by providing a centralized platform where users manage their profile, work experiences, and a library of personal stories. A Chrome extension detects form fields on any job application page and returns profile-based suggestions for structured fields (name, email, school) and story-matched draft responses for open-ended prompts (e.g., "Tell us about a time you demonstrated leadership"), with LLM assistance used for relevance scoring and option selection. Additionally, an automated job scraping and matching pipeline recommends relevant positions based on user preferences, saving time and improving application quality.

**Target Users:** University students and professionals actively seeking internships or full-time positions who apply to multiple companies across different platforms.

---

## Objectives

The primary objective of HireMePlz is to build a production-grade, cloud-native application that demonstrates mastery of containerization, orchestration, persistent storage, and monitoring — the core pillars of the ECE1779 course. Specifically, we aimed to:

1. **Automate repetitive form-filling** with AI-powered suggestions that respect the user's unique background.
2. **Centralize application tracking** so users can monitor their pipeline from draft to offer.
3. **Recommend matching jobs** through automated scraping and scoring based on user profiles and preferences.
4. **Deploy a resilient, observable system** on cloud infrastructure with auto-scaling, security hardening, CI/CD, and automated backups.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Backend API** | Express.js, Prisma ORM, Zod validation |
| **LLM Worker** | BullMQ consumer, OpenAI API (GPT-4o-mini) |
| **Job Scraper Worker** | BullMQ consumer, Python `jobspy` library |
| **Chrome Extension** | Manifest V3, esbuild, TypeScript |
| **Database** | PostgreSQL 16 |
| **Message Queue** | Redis 7 (BullMQ) |
| **Orchestration** | **Kubernetes** (single-node k3s) |
| **Deployment** | DigitalOcean Droplet, k3s, Kustomize manifests |
| **Ingress & TLS** | Nginx Ingress Controller, cert-manager + Let's Encrypt |
| **Monitoring** | Prometheus v3.2.1, Grafana 11.5.2, Loki 3.4.2, Promtail 3.4.2 |
| **CI/CD** | GitHub Actions (CI + Docker image publishing to GHCR) |
| **Backup** | K8s CronJob → pg_dump → gzip → DigitalOcean Spaces (S3-compatible) |
| **Language** | TypeScript (all services), Python (job scraping script) |
| **Runtime** | Node.js 22 |

---

## Features

### Core Technical Requirements — All Fulfilled

**Primary language:** TypeScript (with a Python helper script for job scraping).

#### 1. Docker Containerization & Multi-Container Setup

Every service has its own `Dockerfile` optimized for production (multi-stage builds with Alpine/Slim base images). A `docker-compose.yml` provides **one-command local startup** for all 11 services:

- **Application services:** `frontend`, `backend`, `worker`, `worker-llm`
- **Infrastructure:** `postgres`, `redis`
- **Monitoring:** `prometheus`, `grafana`, `loki`, `promtail`
- **Backup:** `db-backup`

Health checks enforce startup ordering (database → backend → frontend), and named Docker volumes persist data across restarts.

#### 2. PostgreSQL with Persistent Storage

PostgreSQL 16 stores all user data, jobs, applications, and subscriptions. In Kubernetes, PostgreSQL runs as a **StatefulSet** with a **5 Gi PersistentVolumeClaim** (backed by DigitalOcean Block Storage), ensuring data survives pod restarts, redeployments, and node failures.

The database schema (managed via Prisma) includes 11 models: `User`, `Profile`, `Education`, `Experience`, `StoryItem`, `Application`, `Job`, `JobMatch`, `JobSubscription`, and `JobIngestionRun`, with appropriate indexes and unique constraints.

#### 3. Kubernetes Orchestration

All services are deployed to a **single-node k3s Kubernetes cluster on a DigitalOcean Droplet** using **Kustomize**. Key orchestration features include:

- **Backend:** 2 replicas with `RollingUpdate` strategy (`maxSurge: 1`, `maxUnavailable: 0`) for zero-downtime deploys
- **InitContainer:** Runs `prisma db push` on every deployment to apply schema migrations automatically
- **Readiness & liveness probes** on all services (HTTP health checks for app services, `pg_isready` for Postgres, `redis-cli ping` for Redis)
- **Resource requests and limits** defined for every container
- **Ingress routing** via Nginx Ingress Controller for three domains:
  - `hiremeplz.info` → Frontend
  - `api.hiremeplz.info` → Backend API
  - `grafana.hiremeplz.info` → Grafana dashboards

#### 4. Monitoring & Observability

A full observability stack is deployed alongside the application:

- **Prometheus** scrapes `/metrics` from the backend (via `prom-client`) with 15-day retention, and evaluates custom alert rules covering CPU/memory usage, HTTP 5xx error rate (>5%), P95 latency (>2s), BullMQ queue backlog, V8 heap memory, and event loop lag.
- **Grafana** provides pre-provisioned dashboards with panels for request rate, latency percentiles (P50/P90/P99), 5xx error rate, concurrent requests, event loop lag, heap memory, queue status, and top-10 routes by rate.
- **Loki + Promtail** aggregate logs from all containers for centralized log querying and correlation.

### Advanced Features — 4 Implemented

#### 1. Auto-Scaling & High Availability

- **HorizontalPodAutoscaler (HPA):** Backend scales from 2 → 5 replicas when average CPU utilization exceeds 70%. Worker-LLM scales from 1 → 3 replicas under the same policy, with stabilization windows to prevent flapping.
- **PodDisruptionBudget (PDB):** Ensures at least 1 backend pod and 1 frontend pod remain available during rolling updates or node maintenance.

#### 2. Security Enhancements

- **HTTPS everywhere:** cert-manager automatically obtains and renews TLS certificates from Let's Encrypt for all three domains.
- **Authentication:** JWT-based authentication with bcrypt password hashing.
- **Kubernetes NetworkPolicy:** A default-deny ingress policy is applied to the namespace, with fine-grained allow rules:
  - Frontend: only accepts traffic from the Ingress Controller
  - Backend: accepts traffic from Ingress Controller, Frontend, and Prometheus
  - PostgreSQL: only accessible from backend, worker, worker-llm, and backup pods
  - Redis: only accessible from backend, worker, and worker-llm
  - Prometheus: only accessible from Grafana
  - Loki: only accessible from Grafana and Promtail

#### 3. CI/CD Pipeline

- **CI (`ci.yml`):** Triggered on every push to `main` and all pull requests. Spins up a PostgreSQL 16 service container, installs dependencies, generates Prisma client, pushes the schema, runs `tsc --noEmit` type checking across all packages, and builds all services.
- **CD (`docker-publish.yml`):** On push to `main` or version tags, a matrix job builds and pushes Docker images for 4 services (`backend`, `frontend`, `worker`, `worker-llm`) to **GitHub Container Registry (GHCR)** using Docker Buildx with GitHub Actions cache.

#### 4. Automated Backup & Recovery

- A Kubernetes **CronJob** runs daily at **02:00 UTC**, executing `pg_dump | gzip` and uploading the compressed backup to **DigitalOcean Spaces** (S3-compatible object storage).
- Retains the last 3 successful and 3 failed job histories for auditability.
- Credentials are securely injected from Kubernetes Secrets.

---

## User Guide

### 1. Registration & Login

Visit [hiremeplz.info](https://hiremeplz.info) and create an account with an email and password. After registration, you are redirected to the dashboard.

### 2. Profile Management

Navigate to **Dashboard → Profile** to fill in your personal information:
- Full name, phone, location
- School, degree, graduation year
- LinkedIn, GitHub, and portfolio URLs
- Visa status, preferred roles, preferred cities, and skills
- A professional summary

### 3. Education & Experience

- **Dashboard → Experiences:** Add your work experiences with title, company, description, highlights, and skills. Each entry can include start/end dates.
- **Dashboard → Profile → Education:** Add education records with school, degree, field of study, and dates.

### 4. Story Library

Navigate to **Dashboard → Stories** to build a library of personal stories (e.g., leadership examples, technical challenges, teamwork scenarios). Each story has a title, content, and tags for easy retrieval. The autofill pipeline uses these stories to retrieve the most relevant draft response for open-ended application questions.

### 5. Smart Autofill (Chrome Extension)

1. Build the extension with `npm run build --workspace extension`, then install it in Chrome by loading the unpacked `extension/` folder.
2. Navigate to any job application page.
3. The extension's content script scans the page for form fields, detects structured fields (name, email, phone) and open-ended prompts.
4. Click the extension popup to trigger autofill — the backend retrieves your profile and stories, matches structured fields from profile data, scores story relevance for open-ended prompts, and returns field-by-field suggestions.
5. Review and confirm suggestions before they are filled into the page.
6. The application is automatically recorded in your application history.

### 6. Job Recommendations & Subscriptions

- **Dashboard → Jobs:** View job recommendations scored and ranked by how well they match your profile.
- **Dashboard → Jobs → Subscriptions:** Create job subscriptions with keywords, locations, remote preference, job types, and target sites (LinkedIn, Indeed, Glassdoor, etc.). The worker service periodically scrapes matching jobs and scores them against your profile.

### 7. Application Tracking

**Dashboard → Applications** displays all your applications with status tracking (Draft → Applied → Interviewing → Rejected / Offer), company, role, source, and notes.

---

## Development Guide

### Prerequisites

- **Node.js 22** (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **Docker** and **Docker Compose**
- **Python 3** (for the job scraping worker, installed automatically in the Docker image)

### Environment Setup

1. Clone the repository:

```bash
git clone https://github.com/Erica-cod/HireMePlz.git
cd HireMePlz
```

2. Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Key variables to configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `OPENAI_API_KEY` | OpenAI API key for LLM autofill |
| `OPENAI_MODEL` | Model name (default: `gpt-4o-mini`) |
| `DO_SPACES_KEY/SECRET/BUCKET/REGION` | DigitalOcean Spaces for backup |

### Local Development (Without Docker)

```bash
npm install                # Install all workspace dependencies
npm run db:generate        # Generate Prisma client
npm run db:push            # Sync schema to local PostgreSQL
npm run dev:backend        # Start backend on :4000
npm run dev:frontend       # Start frontend on :3000
npm run dev:worker         # Start job scraping worker
```

Build the Chrome extension:

```bash
npm run build --workspace extension
```

Then load the unpacked `extension/` folder in Chrome.

### Local Development (With Docker)

```bash
docker compose up --build
```

This starts all 11 services (app + monitoring stack). Access:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Grafana: http://localhost:3001 (admin / admin)
- Prometheus: http://localhost:9090

### Database

- **ORM:** Prisma with PostgreSQL provider
- **Schema location:** `backend/prisma/schema.prisma` (also mirrored in `worker/` and `worker-llm/`)
- **Migrations:** We use `prisma db push` for schema synchronization (no SQL migration files)
- **Models:** User, Profile, Education, Experience, StoryItem, Application, Job, JobMatch, JobSubscription, JobIngestionRun

### Project Structure

```
HireMePlz/
├── backend/          # Express + Prisma API server
│   ├── src/
│   │   ├── modules/  # auth, profile, experience, story, application, autofill, jobs
│   │   ├── middleware/
│   │   ├── lib/      # BullMQ queues, metrics
│   │   └── routes/
│   ├── prisma/       # Database schema
│   └── Dockerfile
├── frontend/         # Next.js App Router dashboard
│   ├── app/          # Pages: auth, dashboard/*
│   ├── components/
│   ├── lib/          # API client
│   └── Dockerfile
├── worker/           # Job scraping BullMQ worker
│   ├── src/
│   ├── scripts/      # jobspy_fetch.py
│   └── Dockerfile
├── worker-llm/       # LLM autofill BullMQ worker
│   ├── src/
│   └── Dockerfile
├── extension/        # Chrome MV3 extension
│   ├── src/          # content.ts, popup.ts, detectors, matcher, rules
│   └── manifest.json
├── k8s/              # Kubernetes manifests (Kustomize)
│   ├── postgres/     # StatefulSet + Service
│   ├── redis/        # Deployment + Service
│   ├── backend/      # Deployment + Service
│   ├── frontend/     # Deployment + Service
│   ├── worker/       # Deployment
│   ├── worker-llm/   # Deployment
│   ├── monitoring/   # Prometheus, Grafana, Loki, Promtail
│   ├── backup/       # CronJob
│   ├── hpa.yaml      # HorizontalPodAutoscaler
│   ├── pdb.yaml      # PodDisruptionBudget
│   ├── network-policy.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
├── monitoring/       # Docker Compose monitoring configs
│   ├── prometheus/   # prometheus.yml, alert-rules.yml
│   ├── grafana/      # Provisioning, dashboards
│   ├── loki/         # loki-config.yml
│   └── promtail/     # promtail-config.yml
├── scripts/backup/   # DB backup Docker image
├── .github/workflows/
│   ├── ci.yml        # CI: type-check + build
│   └── docker-publish.yml  # CD: build & push to GHCR
├── docker-compose.yml
├── docker-compose.ghcr.yml
└── .env.example
```

---

## Deployment Information

The application is deployed on a **DigitalOcean Droplet running single-node k3s** and accessible at:

| Service | URL |
|---------|-----|
| **Frontend** | [https://hiremeplz.info](https://hiremeplz.info) |
| **Backend API** | [https://api.hiremeplz.info](https://api.hiremeplz.info) |
| **Grafana Dashboard** | [https://grafana.hiremeplz.info](https://grafana.hiremeplz.info) |

### Deployment Architecture

All services run in the `hiremeplz` namespace on a DigitalOcean Droplet running a single-node k3s Kubernetes cluster. Kustomize manages all manifests under the `k8s/` directory. The deployment flow is:

1. Developer pushes to `main` branch
2. GitHub Actions builds 4 Docker images (backend, frontend, worker, worker-llm)
3. Images are pushed to GitHub Container Registry (GHCR)
4. The k3s cluster runs the published images using the manifests under `k8s/`

TLS certificates are automatically managed by cert-manager with Let's Encrypt. Nginx Ingress Controller handles routing and TLS termination for all three domains.

---

## AI Assistance & Verification (Summary)

AI tools (primarily ChatGPT and GitHub Copilot) were used during development in the following areas:

### Where AI Meaningfully Contributed

- **Kubernetes configuration:** AI helped generate initial Kustomize manifests, NetworkPolicy definitions, and HPA configurations. These were then adapted to our specific namespace and service topology.
- **Prometheus alert rules:** AI suggested alert rule templates for HTTP error rates and latency, which we refined with project-specific thresholds and metric names (e.g., `hiremeplz_queue_*`).
- **Docker multi-stage build optimization:** AI provided patterns for reducing image sizes using Alpine base images and separating build/runtime stages.

### Representative Mistake

When configuring Kubernetes NetworkPolicy, AI initially generated policies that allowed all ingress traffic from within the namespace (using a broad `podSelector: {}`), which defeated the purpose of least-privilege access. We identified this during manual review, rewrote the policies to implement default-deny with explicit per-service allow rules, and verified correctness by testing inter-pod connectivity with `kubectl exec` and `curl`.

See `ai-session.md` for detailed interaction records.

### How Correctness Was Verified

- **Automated CI:** Every push triggers type-checking and full builds
- **Kubernetes probes:** Readiness and liveness probes validate service health continuously
- **Monitoring:** Grafana dashboards and Prometheus alerts confirmed correct metrics collection and alerting behavior
- **Manual testing:** API endpoints tested with Postman/curl; extension tested on real job application pages; NetworkPolicy verified by attempting blocked connections

---

## Individual Contributions

| Team Member | Key Contributions |
|------------|-------------------|
| **Yushun Tang** | *Backend API development, Prisma schema design, BullMQ queue architecture, Chrome extension autofill logic* |
| **Keyin Liang** | *Frontend dashboard development with Next.js, user profile/experience/story management pages, responsive UI design* |
| **Zhengyang Li** | *Kubernetes deployment manifests, Kustomize configuration, HPA/PDB/NetworkPolicy setup, DigitalOcean cluster management, Ingress and TLS configuration* |
| **Irys Zhang** | *CI/CD pipeline with GitHub Actions, monitoring stack setup (Prometheus, Grafana, Loki), automated backup CronJob, worker services* |

> All contributions are reflected in the Git commit history. Each team member maintained regular, meaningful commits throughout the project timeline.

---

## Lessons Learned and Concluding Remarks

### Technical Lessons

1. **Kubernetes complexity vs. value:** Setting up a production-grade Kubernetes deployment with Ingress, TLS, NetworkPolicy, HPA, and PDB is significantly more involved than Docker Compose. However, the resulting system is far more resilient and observable. Understanding how these components interact (e.g., cert-manager needing NetworkPolicy exceptions for ACME solvers) was one of our biggest learning moments.

2. **Stateful services require careful planning:** Running PostgreSQL as a StatefulSet with PersistentVolumeClaims requires understanding storage classes, access modes, and data directory permissions (`PGDATA`). We learned the importance of separating stateless application services from stateful infrastructure.

3. **Monitoring is essential, not optional:** Prometheus metrics and Grafana dashboards proved invaluable during debugging. For example, monitoring event loop lag helped us identify that the LLM worker needed its own deployment (rather than running in the backend process) to avoid blocking API requests.

4. **CI/CD saves time exponentially:** The initial setup cost of GitHub Actions workflows paid for itself quickly. The matrix build strategy for 4 services made image publishing and deployment updates much faster and more reliable.

### Process Lessons

- **Start with Docker Compose, graduate to Kubernetes:** Developing locally with Docker Compose first and then translating to Kubernetes manifests was an effective workflow that avoided the slow feedback loops of remote cluster debugging.
- **BullMQ for decoupling:** Separating the LLM inference and job scraping into dedicated worker processes via BullMQ queues made the system more maintainable and independently scalable.

### Concluding Remarks

HireMePlz demonstrates that a focused, well-scoped application can effectively showcase cloud-native principles. By building a practical tool that solves a real problem (job application fatigue), we were motivated to implement production-quality infrastructure rather than treating the cloud components as afterthoughts. The project gave us hands-on experience with the full lifecycle of a cloud-native application — from local development to Kubernetes deployment, from CI/CD pipelines to observability — skills that are directly applicable to real-world software engineering.

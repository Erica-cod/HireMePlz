# Project Proposal: JobFill — Intelligent Job Application Autofill Platform

**Course**: ECE1779 — Cloud Computing

**Team Members**:

| Name | Student Number | Email |
|---|---|---|
| [Member A] | [Student #] | [email] |
| [Member B] | [Student #] | [email] |
| [Member C] | [Student #] | [email] |
| [Member D] | [Student #] | [email] |

---

## 1. Motivation

Applying for software engineering jobs in North America is a tedious, repetitive process. Job seekers — especially international students and new graduates — often submit 50 to 200+ applications across different company career portals. Each application requires manually entering the same personal information (name, email, phone, education, work history) and answering open-ended questions ("Describe your most challenging project," "Why do you want to join us?"). Despite asking semantically similar questions, every portal uses different form layouts, field names, and phrasing, making browser-native autofill unreliable.

Existing solutions such as browser autofill or LinkedIn Easy Apply only handle basic structured fields and fail on open-ended questions entirely. Tools like Simplify Jobs offer partial autofill but lack intelligent question answering and are closed-source with limited customization.

**JobFill** addresses this gap by combining a Chrome extension with a cloud-native backend to provide:

- **Rule-based autofill** for structured fields (name, email, education, etc.) with intelligent field detection
- **LLM-powered answers** for open-ended questions, drawing from a user's personal experience library
- **Job matching** via public job APIs to recommend relevant positions
- **Application tracking** to record and visualize submission history

Our target users are software engineering job seekers in the North American market — primarily university students, recent graduates, and early-career professionals who submit high volumes of applications across diverse company portals.

---

## 2. Objective and Key Features

### Project Objectives

Build a stateful cloud-native platform consisting of a Chrome browser extension and a web dashboard, backed by a containerized, orchestrated, and monitored backend deployed on DigitalOcean. The system enables job seekers to manage their professional profile, store reusable experiences, autofill job application forms intelligently, discover matching job postings, and track their application history.

### Core Features and Technical Implementation

#### Containerization and Local Development

- **Docker**: Separate Dockerfiles for the frontend (Next.js), backend (Node.js/Express), and Nginx reverse proxy.
- **Docker Compose**: Multi-container local development environment with five services — `nginx`, `frontend`, `backend`, `worker` (cron job processor), and `db` (PostgreSQL). A single `docker-compose up` command brings up the full stack.

#### State Management

- **PostgreSQL**: Nine relational tables storing users, profiles, education, work experience, stories (experience library for LLM), QA templates, jobs, matches, applications, and notifications. Full foreign key relationships and UUID primary keys.
- **Persistent Storage**: DigitalOcean Volumes mounted to the PostgreSQL container's data directory, ensuring data survives container restarts and redeployments.

#### Deployment

- **DigitalOcean Droplets**: Production deployment on DigitalOcean infrastructure. Nginx serves as a reverse proxy with SSL termination (Let's Encrypt) and load balancing across backend replicas.

#### Orchestration — Docker Swarm

- **Docker Swarm Mode**: The backend API service runs with 2+ replicas for load balancing and fault tolerance. Nginx distributes requests across replicas. The worker service runs as a single instance handling scheduled tasks (job fetching, matching, notifications).

#### Monitoring and Observability

- **DigitalOcean Monitoring**: Built-in metrics dashboards for CPU, memory, disk, and network usage across Droplets.
- **Alerts**: Configured alerts for high CPU usage (>80%), high memory usage (>85%), and low disk space.
- **Application-level health**: A `/api/health` endpoint reports backend status, database connectivity, and service uptime for integration with monitoring tools.

### Advanced Features (Three Implemented)

#### 1. Security Enhancements

- JWT-based authentication shared between the web dashboard and Chrome extension
- Password hashing with bcrypt
- HTTPS via Nginx + Let's Encrypt
- Sensitive credentials managed via environment variables (API keys for OpenAI, JSearch, SendGrid never committed to source code)

#### 2. CI/CD Pipeline

- GitHub Actions workflow triggered on push to `main`: lint → test → build Docker images → push to registry → deploy to Docker Swarm on DigitalOcean
- Automated rollback on deployment failure

#### 3. Integration with External Services

- **OpenAI API (GPT-4o-mini)**: Powers the intelligent question-answering engine. When the Chrome extension detects an open-ended question, the backend classifies the question, selects the most relevant experience from the user's story library, and generates a contextually adapted answer.
- **JSearch API (via RapidAPI)**: Fetches real-time job listings from Google Jobs (aggregating LinkedIn, Indeed, Glassdoor) every 6 hours via a cron worker. Jobs are stored in PostgreSQL, deduplicated, and matched against user profiles using a weighted scoring algorithm (skill overlap 70%, location match 20%, experience fit 10%).
- **SendGrid**: Email notifications for high-scoring job matches exceeding the user's configurable threshold.

### Scope and Feasibility

The project is scoped for a 4-person team over approximately one month. The Chrome extension's form detection will prioritize one major ATS platform (Greenhouse) plus a generic HTML form fallback, rather than attempting full compatibility with all platforms. The LLM integration uses a simple prompt-and-respond pattern (no fine-tuning, no embeddings) to keep complexity manageable. The web dashboard uses Tailwind CSS for rapid UI development without custom design work. Each team member is expected to contribute 700–1000 lines of meaningful code.

---

## 3. Tentative Plan

### Team Responsibilities

| Member | Role | Responsibilities |
|---|---|---|
| **A** | Backend Core + Database | Express.js project setup, database schema (init.sql), user auth (JWT + bcrypt), profile/education/experience CRUD APIs, database connection pooling, middleware |
| **B** | Autofill Engine + LLM | Structured field matching rules engine (~50 rules), `/api/autofill/*` endpoints, stories & QA templates CRUD, OpenAI API integration, question classification, answer generation |
| **C** | DevOps + Job System | All Dockerfiles, Docker Compose (dev + prod), Nginx config, Docker Swarm cluster setup, DigitalOcean deployment (Droplets + Volumes + monitoring + alerts), GitHub Actions CI/CD, JSearch API integration, cron worker, matching algorithm, notification system |
| **D** | Frontend + Chrome Extension | Next.js web dashboard (profile management, stories editor, job matches, application history, settings), Chrome extension (Manifest V3, content scripts for DOM scanning, popup UI, autofill preview panel, form filler), UI/UX |

### Week-by-Week Plan

**Week 1 — Foundation**:
All members set up the development environment. Member A creates the Express.js project structure and PostgreSQL schema. Member B begins building the field matching rules engine. Member C writes Dockerfiles and `docker-compose.yml`, getting all services running locally. Member D scaffolds the Next.js project and Chrome extension manifest. By end of week, `docker-compose up` runs the full stack locally.

**Week 2 — Core Features**:
Member A completes all CRUD APIs (profile, education, experience). Member B integrates OpenAI API and implements the autofill endpoints. Member C integrates JSearch API, builds the cron worker, and implements the matching algorithm. Member D builds web dashboard pages and Chrome extension content scripts (form detection + filling). By end of week, core autofill functionality works end-to-end.

**Week 3 — Deployment + Advanced Features**:
Member C deploys to DigitalOcean (Droplets, Volumes, Swarm, monitoring, alerts) and sets up GitHub Actions CI/CD. Member A adds input validation and error handling. Member B refines LLM prompts and adds answer caching. Member D polishes the Chrome extension UI and integrates email notifications. By end of week, the application runs in the cloud with monitoring.

**Week 4 — Polish + Deliverables**:
All members focus on testing, bug fixes, and edge cases. Record the demo video. Write the final report (`README.md`) and AI interaction record (`ai-session.md`). Prepare presentation slides.

---

## 4. Initial Independent Reasoning (Before Using AI)

### Architecture Choices

Our team chose **DigitalOcean** as the deployment provider because several members had prior experience with it from course assignments, and it provides a straightforward IaaS model with integrated monitoring and volume support. We selected **Docker Swarm** over Kubernetes for orchestration because our application has a relatively simple service topology (API + worker + DB) and Swarm's learning curve is significantly lower — we estimated Kubernetes setup alone could consume a full week of our limited timeline. For the database, **PostgreSQL** was a given requirement, and we planned a normalized schema to separate user profile data, experiences, job listings, and application records.

### Anticipated Challenges

We expected the **Chrome extension's form detection** to be the most technically challenging component. Job application portals use inconsistent HTML structures — some use standard `<form>` elements, while others (e.g., Workday) use complex JavaScript-rendered UIs. We anticipated needing a robust fallback strategy rather than trying to support every platform. The second challenge we identified was **LLM response quality** — generating application answers that sound natural and specific (not generic) from a limited experience library would require careful prompt engineering.

### Early Development Approach

Our initial plan was to split the team into backend (2 people) and frontend/extension (2 people), with one backend member also handling DevOps. We reasoned that the backend API would need to be stable before the frontend and Chrome extension could integrate with it, so backend work should start first. We planned to use a shared Postman collection to define API contracts early, allowing parallel development.

---

## 5. AI Assistance Disclosure

### Parts Developed Without AI

The core project idea — an autofill Chrome extension for job applications — originated from our own frustration with the repetitive job application process. The decision to use DigitalOcean, Docker Swarm, and the overall team split were made independently based on our prior experience and course content. The identification of target users and the problem statement came from personal experience as international students applying to North American tech jobs.

### AI Contributions

We used AI (Claude) to help with:

- **Researching available job listing APIs**: AI helped identify JSearch and Adzuna as viable free APIs for fetching North American job postings, including their coverage, pricing, and free-tier limitations. This saved significant research time compared to manually evaluating dozens of API options.
- **Structuring the technical proposal**: AI helped organize the database schema, API route design, and Docker service architecture into a coherent document. The database table structures and API endpoint naming were drafted with AI assistance.
- **Evaluating the feasibility of automatic form submission**: We initially wanted to build fully automated job submission (clicking "Apply" on company sites). AI helped us understand the technical and legal limitations (anti-bot measures, ToS violations) and suggested pivoting to an autofill-only approach, which is both more feasible and ethical.

### Example of AI Influence and Team Discussion

AI suggested using OpenAI's GPT-4o-mini for the question-answering engine. Our team discussed the following tradeoffs before adopting this suggestion:

- **Cost**: At $0.15/1M input tokens, the cost is negligible for a course project, but we discussed what would happen at scale and whether a self-hosted model (e.g., Llama) would be more sustainable. We decided GPT-4o-mini is appropriate for our scope.
- **Latency**: AI noted 1–2 second response times. We discussed whether this would be acceptable UX in the Chrome extension and decided to show a loading indicator while the LLM generates answers, with the option for users to edit before filling.
- **Privacy**: Sending user experiences to OpenAI's API raises privacy concerns. We discussed this and decided it is acceptable for a course project but noted it as a limitation in our design. A production version might require a self-hosted model or on-device inference.

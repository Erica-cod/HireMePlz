# Project Proposal: JobFill — Intelligent Job Application Autofill Platform

**Course**: ECE1779 — Cloud Computing

**Team Members**:

| Name | Student Number | Email |
|---|---|---|
| Yushun Tang  | 1011561962 | yushun.tang@mail.utoronto.ca |
| Keyin Liang  | 1005932788 | keryn.liang@mail.utoronto.ca |
| Zhengyang Li | 1012373977 | zhengyang.li@mail.utoronto.ca |
| Irys Zhang   | 1012794424 | irys.zhang@mail.utoronto.ca |

---

## 1. Motivation

Applying for software engineering jobs in North America is a tedious, repetitive process. Job seekers — especially international students and new graduates — often submit 50 to 200+ applications across different company career portals. Each application requires manually entering the same personal information (name, email, phone, education, work history) and answering open-ended questions ("Describe your most challenging project," "Why do you want to join us?"). Despite asking semantically similar questions, every portal uses different form layouts, field names, and phrasing, making browser-native autofill unreliable.

Existing solutions fall short in key ways. Browser-native autofill only handles basic fields like name and email, and fails when form structures vary. LinkedIn Easy Apply simplifies applications on LinkedIn itself, but most companies — especially mid-size and large firms — use their own career portals (Greenhouse, Lever, Workday), where Easy Apply is unavailable. Tools like Simplify Jobs offer partial autofill for structured fields but completely lack intelligent handling of open-ended questions, which are often the most time-consuming part of an application.

**JobFill** addresses this gap by combining a Chrome extension with a cloud-native backend:

- **Smart autofill** for structured fields (name, email, education, etc.) with intelligent field detection across different portal layouts
- **LLM-powered answers** for open-ended questions, drawing from a user's personal experience library to generate contextually relevant responses
- **Job discovery** via public job APIs to surface matching positions based on the user's skills and preferences
- **Application tracking** to record submission history and visualize progress

Our target users are software engineering job seekers in the North American market — primarily university students, recent graduates, and early-career professionals who submit high volumes of applications across diverse company portals.

---

## 2. Objective and Key Features

### Project Objectives

Build a stateful cloud-native application that helps job seekers autofill application forms intelligently. The system consists of a Chrome browser extension (client), a web dashboard (for managing profile and data), and a cloud-deployed backend with persistent data storage, container orchestration, and monitoring.

### Core Features

**Personal Information Management**: Users maintain a centralized profile containing structured personal data (contact info, education history, work experience, skills, job preferences) and an experience library of pre-written stories (e.g., "a challenging project," "a leadership experience") categorized by common question types. This data is stored persistently and reused across all applications.

**Intelligent Form Autofill (Chrome Extension)**: When a user visits a job application page, the Chrome extension detects form fields and matches them to the user's stored data. Structured fields (name, email, phone, etc.) are matched using a rule-based engine that analyzes field attributes (name, label, placeholder). Open-ended questions (textareas asking about experiences or motivation) are sent to the backend, where an LLM selects the most relevant experience from the user's library and generates a tailored response. Users preview all suggested values before confirming.

**Job Discovery and Matching**: A background worker periodically fetches job listings from public APIs (JSearch, Adzuna) based on user preferences (target roles, locations). Jobs are matched against the user's skill set and ranked by relevance. High-scoring matches trigger notifications.

**Application Tracking**: Each autofill session is recorded — company, position, URL, date, and a snapshot of filled content. Users can view their application history and update statuses (applied, interviewing, rejected, offer) through the web dashboard.

### Technical Requirements

| Requirement | Approach |
|---|---|
| **Containerization** | Docker + Docker Compose for multi-container local development (frontend, backend, worker, database, reverse proxy) |
| **Database** | PostgreSQL for all persistent data (user profiles, experiences, jobs, applications) |
| **Persistent Storage** | DigitalOcean Volumes attached to the database container |
| **Orchestration** | Docker Swarm with service replication and load balancing |
| **Monitoring** | DigitalOcean built-in metrics and alerts for system health |
| **Deployment** | DigitalOcean |

### Advanced Features

1. **Security Enhancements**: JWT authentication, password hashing, HTTPS, and environment-based secrets management for API keys.
2. **CI/CD Pipeline**: GitHub Actions for automated testing, building, and deployment on push.
3. **External Service Integration**: OpenAI API for intelligent question answering, JSearch API for job data, and SendGrid for email notifications.

### Scope and Feasibility

The project is scoped for a 4-person team over approximately one month. The Chrome extension will prioritize compatibility with one major ATS platform (Greenhouse) plus generic HTML forms, rather than attempting to support all platforms. The LLM integration uses a straightforward prompt-and-respond pattern without fine-tuning. The web dashboard will be functional but minimal in design. This scope ensures all core requirements and three advanced features can be delivered within the timeline.

---

## 3. Tentative Plan

### Team Responsibilities

| Member | Role | Key Responsibilities |
|---|---|---|
| Yushun Tang | Backend Core + Database | API server setup, database schema, user authentication, profile and data management APIs |
| Irys Zhang | Autofill Engine + LLM | Field matching rules, autofill API endpoints, experience library management, OpenAI integration for question answering |
| Zhengyang Li | DevOps + Job System | Docker and Compose setup, Swarm deployment, DigitalOcean infrastructure, monitoring, CI/CD, job fetching worker, matching algorithm |
| Keyin Liang | Frontend + Chrome Extension | Web dashboard pages, Chrome extension (form detection, autofill UI, application recording) |

### Week-by-Week Plan

**Week 1 — Foundation**: Set up the development environment. Build the project skeleton — Express.js backend, Next.js frontend, Chrome extension manifest, PostgreSQL schema. Get all services running locally via Docker Compose.

**Week 2 — Core Features**: Implement profile and experience management APIs. Build the autofill engine (rule-based matching + LLM integration). Develop the Chrome extension's form detection and filling logic. Build web dashboard pages.

**Week 3 — Deployment + Advanced Features**: Deploy to DigitalOcean with Docker Swarm. Set up monitoring and alerts. Configure CI/CD with GitHub Actions. Integrate job fetching, matching, and email notifications.

**Week 4 — Polish + Deliverables**: Testing and bug fixes. Record demo video. Write final report (`README.md`) and AI interaction record (`ai-session.md`). Prepare presentation slides.

---

## 4. Initial Independent Reasoning (Before Using AI)

### Architecture Choices

Our team chose **DigitalOcean** because several members had prior experience with it from course assignments, and its IaaS model provides integrated monitoring and volume support out of the box. We selected **Docker Swarm** over Kubernetes because our service topology is relatively simple (API server + worker + database), and we estimated that Kubernetes setup alone could consume a disproportionate amount of our limited timeline. PostgreSQL was chosen as required, with a normalized schema separating user data, experiences, jobs, and applications.

### Anticipated Challenges

We expected the **Chrome extension's form detection** to be the hardest part. Job portals use inconsistent HTML structures — some use standard `<form>` elements while others use JavaScript-rendered UIs with non-standard attributes. We planned to focus on one major ATS platform first and build a generic fallback. The second challenge we identified was **LLM response quality** — generating answers that sound natural and specific rather than generic from a limited experience library.

### Early Development Approach

We planned to split into backend (2 people) and frontend/extension (2 people), with one backend member also handling DevOps. Backend work would start first since the API needs to be stable before the frontend and Chrome extension can integrate. We planned to define API contracts early using shared documentation to enable parallel development.

---

## 5. AI Assistance Disclosure

### Parts Developed Without AI

The core project idea originated from our own frustration with repetitive job applications. The decision to use DigitalOcean and Docker Swarm, the team split, and the identification of target users all came from team discussion and personal experience as international students applying to North American tech jobs.

### AI Contributions

We used AI (Claude) to help with:

- **Researching job listing APIs**: AI identified JSearch and Adzuna as viable free APIs for North American job data, saving us time evaluating options manually.
- **Structuring the ideas for our proposal**: AI helped organize our ideas into a coherent structure with clear explanations.
- **Evaluating feasibility of automated submission**: We initially wanted fully automated job submission (clicking "Apply" programmatically). AI explained the technical and legal barriers (anti-bot measures, ToS violations), leading us to pivot to an autofill-only approach.

### Example of AI Influence and Team Discussion

AI suggested using OpenAI's GPT-4o-mini for question answering. Before adopting this, our team discussed tradeoffs:

- **Cost vs. capability**: GPT-4o-mini is inexpensive ($0.15/1M tokens) and sufficient for our needs. We considered self-hosted alternatives (e.g., Llama) but decided they add unnecessary infrastructure complexity for a course project.
- **Privacy**: Sending user experiences to an external API raises concerns. We accepted this for the course project scope but noted it as a design limitation — a production system might require on-device inference.
- **Latency**: 1–2 second response times are acceptable if we show a loading indicator and let users edit before filling.

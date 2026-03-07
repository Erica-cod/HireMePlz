# HireMePlz


![Hire Me Please!](https://media1.tenor.com/m/JqxVqlU-M0IAAAAd/%D1%82%D0%BE%D0%BC-%D0%B8.gif)

HireMePlz is a project that helps job seekers centrally manage their data, intelligently fill application forms, track application history, and get job recommendations. This repository currently implements four core subprojects with an MVP-first scope:

- `frontend`: Next.js web dashboard
- `backend`: Express + Prisma API
- `extension`: Chrome extension for form field detection and filling
- `worker`: background job fetching and matching tasks

## MVP Scope

![😁](https://media1.tenor.com/m/tn4LOK2uvroAAAAC/tom-and.gif)

The current priority is to ensure this end-to-end flow works:

1. User registration and login
2. Maintain profile, experiences, and story library
3. Chrome extension scans fields on the current application page
4. Backend returns structured field suggestions and open-ended answer suggestions
5. User confirms suggestions and fills the page
6. Automatically record the application session

## Quick Start

1. Copy the environment variable template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Generate Prisma Client and sync the database:

```bash
npm run db:generate
npm run db:push
```

4. Start services in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:worker
```

5. Build the extension:

```bash
npm run build --workspace extension
```

## Docker

You can also run the development environment with Docker Compose:

```bash
docker compose up --build
```

## Production (Swarm + HTTPS)

Production deployment supports Docker Swarm with a Traefik HTTPS reverse proxy, and uses Docker secrets for sensitive configuration.

- Stack configuration: `deploy/swarm-stack.yml`
- Deployment variable example: `deploy/swarm.env.example`
- Secrets bootstrap script: `deploy/bootstrap-secrets.sh`
- Deployment script: `deploy/deploy-stack.sh`
- Detailed guide: `docs/deployment.md`

GitHub Actions already includes an automatic deployment stage (triggered on push to `main`/`master`).

## Module Overview

- `backend` exposes APIs for authentication, profile management, story library, application records, intelligent suggestions, and job recommendations
- `frontend` provides dashboard pages
- `extension` scans form fields via content scripts and calls backend APIs
- `worker` supports job fetching and matching, and falls back to built-in sample data when external API keys are unavailable

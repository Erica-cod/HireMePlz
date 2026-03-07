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

## Docker Swarm

This repo includes a production-oriented Swarm stack:

- Traefik reverse proxy with automatic HTTPS (Let's Encrypt)
- Internal service networking
- Docker secrets for sensitive values
- Parameterized image tags for CI/CD deploys

### 1) Prepare non-secret deployment variables

```bash
cp deploy/swarm.env.example deploy/swarm.env
```

Set values in `deploy/swarm.env`:

- `IMAGE_REGISTRY` (e.g. `ghcr.io/<your-org-or-user>`)
- `IMAGE_TAG` (e.g. a commit SHA)
- `DOMAIN` (public domain for the app)
- `LETSENCRYPT_EMAIL` (TLS certificate contact email)

### 2) Prepare secrets on Swarm manager

Create `deploy/secrets.env` with:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `JSEARCH_API_KEY`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

Then run:

```bash
./deploy/bootstrap-secrets.sh ./deploy/secrets.env
```

### 3) Initialize Swarm (first time only)

```bash
docker swarm init
```

### 4) Deploy

```bash
./deploy/deploy-stack.sh ./deploy/swarm.env
```

The stack routes:

- `https://<DOMAIN>/` -> frontend
- `https://<DOMAIN>/api/*` -> backend

## Monitoring Recommendations

- Minimum setup: enable DigitalOcean CPU, memory, disk, and container restart alerts
- Backend should expose `/api/health` probe checks
- For extended monitoring, integrate Prometheus + Grafana or use cloud-native monitoring

## GitHub Actions CD (Auto Deploy)

`/.github/workflows/ci.yml` now includes a deploy job on push to `main`/`master`.

Required repository secrets:

- `SWARM_HOST`
- `SWARM_USER`
- `SWARM_SSH_KEY`
- `DEPLOY_PATH` (absolute path on server where `deploy/` files are copied)
- `DEPLOY_DOMAIN`
- `LETSENCRYPT_EMAIL`
- `OPENAI_MODEL` (optional; defaults to `gpt-4o-mini`)
- `JOB_ALERT_MIN_SCORE` (optional; defaults to `0.75`)
- `SWARM_POSTGRES_PASSWORD`
- `SWARM_DATABASE_URL`
- `SWARM_JWT_SECRET`
- `SWARM_OPENAI_API_KEY`
- `SWARM_JSEARCH_API_KEY`
- `SWARM_ADZUNA_APP_ID`
- `SWARM_ADZUNA_APP_KEY`
- `SWARM_SENDGRID_API_KEY`
- `SWARM_SENDGRID_FROM_EMAIL`

The workflow builds/pushes backend/frontend/worker images to GHCR, ensures required Docker secrets exist on the Swarm manager, then deploys `deploy/swarm-stack.yml`.

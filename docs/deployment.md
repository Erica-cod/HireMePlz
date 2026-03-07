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

This repo includes [swarm-stack.yml](../deploy/swarm-stack.yml). Before production deployment:

1. Push all three images to your image registry
2. Prepare environment variables on the server
3. Initialize Swarm: `docker swarm init`
4. Deploy stack:

```bash
docker stack deploy -c deploy/swarm-stack.yml hiremeplz
```

## Monitoring Recommendations

- Minimum setup: enable DigitalOcean CPU, memory, disk, and container restart alerts
- Backend should expose `/api/health` probe checks
- For extended monitoring, integrate Prometheus + Grafana or use cloud-native monitoring

# Deployment

## Docker Compose (on openclaw-staging)
```bash
cd /opt/crm
docker compose up -d     # Start all services
docker compose logs -f    # Watch logs
```

## Services
| Service | Internal Port | External |
|---------|--------------|----------|
| Postgres | 5432 | Internal |
| Redis | 6379 | Internal |
| Backend (FastAPI) | 8000 | Internal |
| Worker (Celery) | 8000 | Internal |
| Frontend (nginx) | 80 → 8091 | `newcrm.turbial.com` |

## Domain
`newcrm.turbial.com` → Caddy (443, LE cert) → nginx (80) → React SPA (8091)

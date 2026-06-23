# AGENTS.md — Mighty CRM

**The platform CRM.** Pipeline management, campaign tracking, lead scoring, contact management. This is the ONE CRM — not Reach CRM, not EspoCRM, not GRP's separate thing. Mighty CRM is where customers, deals, tasks, files, messages, and workflows live.

## Architecture

- **Backend:** FastAPI (Python) in Docker, port 8000
- **Frontend:** React SPA served by nginx, port 8091
- **Infra:** Docker Compose (postgres + redis + backend + worker + frontend nginx)
- **Deploy:** `/opt/crm/` on openclaw-staging
- **Domain:** `newcrm.turbial.com` (Caddy → nginx → React SPA)

## Rules

1. **This is the canonical CRM.** Do NOT build CRM features in other repos. If it's a customer/contact/deal/task feature, it goes here.
2. **No direct DB writes from outside this repo.** CRM data is owned by Mighty CRM. Other services read via API or shared Supabase.
3. **Tenant isolation via `tenant_id` column** on every table. RLS policies enforced at the application layer.

## What NOT to touch

- Reach CRM's `contacts` table in shared Supabase (migration path: consolidate into Mighty CRM later)
- The pixel tracker on port 3099 (separate service)
- EspoCRM instance at `crm.turbial.com` (legacy)

## Deployment

```bash
cd /opt/crm
docker compose up -d
```

## Creating an Owner User
```bash
docker compose exec backend python scripts/create_owner.py --email marcus@turbial.com
```

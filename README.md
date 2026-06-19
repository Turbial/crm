# CRM — Customer Relationship Management

Pipeline management, campaign tracking, lead scoring, and email integration for Turbile products.

## Architecture

```
crm/
├── packages/
│   ├── api/        # REST API server (Express/Fastify)
│   ├── web/        # Dashboard UI
│   ├── shared/     # Shared types, utilities, DB schema
│   ├── pipeline/   # Pipeline board engine
│   └── email/      # Email campaign integration
├── src/            # App entry points
└── scripts/        # Utility scripts
```

## Features

- Pipeline board with drag-and-drop
- Lead scoring and qualification
- Campaign tracking and analytics
- Email integration (Winnr/SendGrid)
- Contact management
- Activity/engagement timeline

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## License

Proprietary — Turbile LLC

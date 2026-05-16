# OriCMS Deployment Guide

Deploy OriCMS using the checked-in production compose stack or an equivalent self-hosted setup.

## Production Compose Stack

The checked-in `docker-compose.prod.yml` is the current full reference stack in this repository.

It includes:

- `web`
- `api`
- `postgres`

If you use that file directly, that is the checked-in deployment shape. TLS, ingress, and reverse proxy behavior are now external concerns rather than built-in repo infrastructure.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/oricms/oricms.git
cd oricms

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your deployment settings

# Start the checked-in production stack
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec api npx prisma migrate deploy
```

After the stack is up, open the web app on the published web port and complete the first-run owner and project onboarding flow there.

## System Requirements

### Minimum

| Component | Specification |
|-----------|---------------|
| CPU | 2 cores |
| RAM | 4 GB |
| Storage | 20 GB SSD |
| OS | Ubuntu 22.04 LTS |

### Recommended

| Component | Specification |
|-----------|---------------|
| CPU | 4+ cores |
| RAM | 8 GB |
| Storage | 50 GB SSD |
| OS | Ubuntu 22.04/24.04 LTS |

## Environment Configuration

### Main API Requirements

At minimum, the API runtime needs:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens (min 32 chars)
- `ENCRYPTION_KEY`: AES-256-GCM encryption key (64 hex chars)
- `RATE_LIMIT_REDIS_URL`: shared Redis for production API rate limiting

For reverse-proxied deployments, also set:

- `TRUST_PROXY`: explicit trusted hop count or proxy rule for client-IP derivation

The checked-in production compose file currently passes:

- `NODE_ENV`
- `ALLOW_FILE_REPO_URLS`
- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `FRONTEND_URL`
- `APP_BASE_URL`
- `TRUST_PROXY`
- `RATE_LIMIT_REDIS_URL`
- `RATE_LIMIT_REDIS_PREFIX`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

The checked-in compose stack now includes Redis for shared API rate-limit counters. If you already run managed Redis outside the repo, point `RATE_LIMIT_REDIS_URL` at that service instead.

### Frontend Behavior

The checked-in production compose file publishes the web container directly and keeps API proxying inside the web image:

- `VITE_API_URL=/api`
- same-origin API proxying through the web container
- external TLS or ingress handled outside this repository when needed

### Compose Excerpt

The checked-in file is the source of truth. The excerpt below is intentionally abbreviated; use `docker-compose.prod.yml` directly when you need the exact service definitions:

```yaml
services:
  web:
  api:
  postgres:
  redis:
```

## Example `.env`

```bash
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=oricms

# JWT
JWT_SECRET=your-jwt-secret

# Encryption for stored secrets
ENCRYPTION_KEY=your-64-char-hex-key

# Public application URLs
FRONTEND_URL=https://cms.example.com
APP_BASE_URL=https://cms.example.com

# Proxy-aware identity and shared rate-limit storage
TRUST_PROXY=1
RATE_LIMIT_REDIS_URL=redis://redis:6379/0

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

```

## TLS and Ingress

The repository no longer ships a built-in edge proxy or certificate management layer.

If you need HTTPS, custom domains, or ingress control, place OriCMS behind your own:

- reverse proxy
- load balancer
- platform ingress
- TLS terminator

When you do that, keep `TRUST_PROXY` aligned with the number of trusted hops between the public client and the API container. A common single-ingress setup uses `TRUST_PROXY=1`.

## Database

### Migrations

```bash
docker-compose exec api npx prisma migrate deploy
```

### First-Run Setup

After migrations complete:

1. open the web app through the published web port or your own ingress layer
2. create the first owner account
3. create the first project through onboarding
4. verify the API health endpoint and the main workspace areas

The first project flow creates a managed local repository by default when you choose the standard onboarding path.

### Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U "${DB_USER:-postgres}" "${DB_NAME:-oricms}" | gzip > backup_$DATE.sql.gz
```

## Extras

The checked-in production compose file stays intentionally small. Add platform-specific ingress, TLS, observability, and secret-management layers outside the repository.

## Related Docs

- [environment-variables.md](./environment-variables.md)
- [rate-limiting-runbook.md](./rate-limiting-runbook.md)
- [self-hosting.md](./self-hosting.md)
- [../configuration/deployment-and-build-hooks.md](../configuration/deployment-and-build-hooks.md)

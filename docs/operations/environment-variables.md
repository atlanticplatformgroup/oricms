# Environment Variables

Use this page when you need the current deployment-time variables that matter for running OriCMS safely.

This page intentionally covers setup, deployment, and supported runtime configuration. It does not try to mirror every defensive limit or tuning constant that happens to exist in code.

## Start With These

For the main API runtime, these values matter first:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for the API. |
| `JWT_SECRET` | Signs access and refresh tokens. |
| `ENCRYPTION_KEY` | Encrypts stored secrets such as Git credentials, delivery secrets, and CDN credentials. The agent confirmation-token fallback also uses it when `JWT_SECRET` is missing. |

If any of those are missing, the main product runtime is not correctly configured.

## Core Runtime

These variables shape where and how the API runs:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode, typically `development` or `production`. |
| `PORT` | API listen port. |
| `LOG_LEVEL` | Winston log level for the API. |
| `WORKSPACE_ROOT` | Root directory for managed project repositories. Set this explicitly in real deployments so git and asset services resolve the same workspace root. |
| `FRONTEND_URL` | Allowed browser origins for API CORS. Also used as the fallback base URL for invite links when `APP_BASE_URL` is not set. |
| `APP_BASE_URL` | Preferred base URL for invite links and other outward-facing project URLs. |
| `TRUST_PROXY` | Express trust-proxy setting for deriving client IPs safely behind ingress or load balancers. Use an explicit hop count or trusted proxy rule rather than relying on defaults. |
| `ALLOW_FILE_REPO_URLS` | Development-only escape hatch for local `file://` repository URLs. Keep `false` in production. |

API abuse-control variables:

| Variable | Purpose |
| --- | --- |
| `RATE_LIMIT_REDIS_URL` | Shared Redis connection string used for production API rate-limit counters. Required for production-grade multi-instance deployments. |
| `RATE_LIMIT_REDIS_PREFIX` | Optional Redis key prefix for rate-limit state. Useful when multiple environments share one Redis cluster. |
| `RATE_LIMIT_STORE` | Development/test override for forcing `memory` or `redis`. Do not rely on `memory` in production. |

Delivery projection controls:

| Variable | Purpose |
| --- | --- |
| `ENABLE_DELIVERY_PROJECTION_RECONCILER` | Enables the periodic delivery-projection repair loop. Default behavior is on; set to `false` only if you are intentionally disabling background reconciliation. |
| `DELIVERY_PROJECTION_RECONCILE_MS` | Interval for the periodic delivery-projection reconciler in milliseconds. |
| `ENABLE_DELIVERY_PROJECTION_WATCHER` | Enables the optional filesystem watcher that accelerates projection refresh after local repository changes. Treat this as a responsiveness feature, not the source of truth. |

## Sign-In and Auth-Adjacent Configuration

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | Enables GitHub OAuth sign-in. |
| `GITHUB_CLIENT_SECRET` | Secret paired with the GitHub OAuth app. |

For web development, the frontend also cares about:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Explicit API base URL for the web app. |
| `DOCKER_ENV` | Local Docker development hint used by the web app. |

## Webhook and Environment Actions

Use these when projects trigger build, deploy, revalidation, or plugin webhook activity:

| Variable | Purpose |
| --- | --- |
| `WEBHOOK_ALLOWED_HOSTS` | Global outbound host allowlist for environment webhooks. |
| `BUILD_WEBHOOK_ALLOWED_HOSTS` | Build-hook specific outbound host allowlist. |
| `REVALIDATION_WEBHOOK_ALLOWED_HOSTS` | Revalidation-hook specific outbound host allowlist. |
| `WEBHOOK_ALLOW_INSECURE_HTTP` | Allows `http://` webhook targets when explicitly enabled. |
| `WEBHOOK_BLOCK_PRIVATE_NETWORKS` | Blocks localhost and private-network webhook targets. |
| `BUILD_WEBHOOK_BLOCK_PRIVATE_NETWORKS` | Build-hook override for private-network blocking. |
| `REVALIDATION_WEBHOOK_BLOCK_PRIVATE_NETWORKS` | Revalidation-hook override for private-network blocking. |
| `WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS` | Blocks DNS resolutions that land on private-network addresses. |
| `BUILD_WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS` | Build-hook DNS blocking override. |
| `REVALIDATION_WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS` | Revalidation-hook DNS blocking override. |
| `REVALIDATION_WEBHOOK_AUTH_MODE` | Controls how revalidation requests are authenticated. |
| `WEBHOOK_DNS_CACHE_TTL_MS` | DNS cache lifetime for outbound webhook safety checks. |
| `WEBHOOK_RETRY_ATTEMPTS` | Default retry-attempt count for environment webhook dispatches. |
| `WEBHOOK_TIMEOUT_MS` | Default timeout for environment webhook dispatches. |
| `WEBHOOK_BACKOFF_MS` | Default retry backoff for environment webhook dispatches. |
| `BUILD_WEBHOOK_RETRY_ATTEMPTS` | Build-hook override for retry attempts. |
| `BUILD_WEBHOOK_TIMEOUT_MS` | Build-hook override for timeout. |
| `BUILD_WEBHOOK_BACKOFF_MS` | Build-hook override for retry backoff. |
| `REVALIDATION_WEBHOOK_RETRY_ATTEMPTS` | Revalidation-hook override for retry attempts. |
| `REVALIDATION_WEBHOOK_TIMEOUT_MS` | Revalidation-hook override for timeout. |
| `REVALIDATION_WEBHOOK_BACKOFF_MS` | Revalidation-hook override for retry backoff. |

Alert routing for failed environment actions uses:

| Variable | Purpose |
| --- | --- |
| `WEBHOOK_ALERTS_ENABLED` | Enables alert routing for repeated dispatch failures. |
| `WEBHOOK_ALERTS_SLACK_WEBHOOK_URL` | Slack alert target. |
| `WEBHOOK_ALERTS_PAGERDUTY_ROUTING_KEY` | PagerDuty alert target. |
| `WEBHOOK_ALERTS_PAGERDUTY_SEVERITY` | PagerDuty severity label. |
| `WEBHOOK_ALERTS_SOURCE` | PagerDuty source label. |

Optional email-delivery webhook routing uses:

| Variable | Purpose |
| --- | --- |
| `EMAIL_WEBHOOK_URL` | Optional outbound email-delivery webhook endpoint. |
| `EMAIL_WEBHOOK_BEARER_TOKEN` | Optional bearer token for the email webhook. |

## Practical Guidance

- Keep secrets out of the repository and deployment logs.
- Document environment-variable changes alongside deployment changes.
- Treat `TRUST_PROXY` and `RATE_LIMIT_REDIS_URL` as paired deployment settings for any API that sits behind ingress, a reverse proxy, or multiple replicas.
- Production route tiers are intentionally separated for auth, core API, delivery, agent, system, and webhook traffic so one class of traffic does not exhaust every endpoint together.
- Re-verify adapter publish loops after changing environment URLs, webhook targets, or workspace paths.
- Prefer the checked-in `.env.example` files as the starting point for local and deployment-specific configuration:
  - root `.env.example` for repo-level web and compose variables
  - `packages/api/.env.example` for the API runtime
- The checked-in production compose file no longer passes legacy `REDIS_URL` or `S3_*` variables to the API. CDN credentials are managed through project configuration and encrypted at rest rather than loaded from global API env vars.

## Related Docs

- [deployment.md](./deployment.md)
- [rate-limiting-runbook.md](./rate-limiting-runbook.md)
- [../configuration/authentication.md](../configuration/authentication.md)
- [../configuration/deployment-and-build-hooks.md](../configuration/deployment-and-build-hooks.md)

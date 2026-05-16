# OriCMS Operations

Use this section when you are deploying, hosting, or troubleshooting a running OriCMS installation.

## What This Section Covers

- deployment and rollout guidance
- self-hosting expectations
- environment-variable categories
- build and revalidation troubleshooting
- API rate limiting operations
- plugin runtime operations

## Start With Supported Checks

Before making changes to a running system, verify the surfaces the product actually exposes today:

- `GET /health`
  - API health endpoint
  - checks database connectivity and basic Git availability
- `GET /api/v1/system/status`
  - setup-state endpoint
  - reports whether the instance still needs its first owner or first project

If you are using the production Compose example, also verify the container state with your container runtime before touching application data.

## Avoid Ad-Hoc Recovery Steps

Older OriCMS docs included direct SQL deletes, reset-token generation snippets, Redis cache commands, and maintenance-mode instructions. Those procedures were removed from this page because they are not maintained as a supported operational contract for the current product.

When you need to change live data or recover from an incident:

- prefer the application UI or current API routes first
- take a backup before making direct database or repository changes
- document any environment-specific runbooks outside the canonical product docs

## Current Pages

- [deployment.md](./deployment.md)
- [self-hosting.md](./self-hosting.md)
- [environment-variables.md](./environment-variables.md)
- [rate-limiting-runbook.md](./rate-limiting-runbook.md)
- [build-troubleshooting.md](./build-troubleshooting.md)
- [plugin-system-runbook.md](./plugin-system-runbook.md)
- [plugin-operations-troubleshooting.md](./plugin-operations-troubleshooting.md)

## Related Docs

- [../configuration/README.md](../configuration/README.md)
- [../reference/api-overview.md](../reference/api-overview.md)

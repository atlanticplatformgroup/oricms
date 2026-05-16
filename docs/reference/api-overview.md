# OriCMS API Overview

Use this page as the entry point to the API surface in this repository.

It is intentionally a route-family map, not a promise that every endpoint is documented exhaustively in one hand-maintained page.

If you are trying to discover the correct content-read endpoint first, start with:

- [content-delivery.md](./content-delivery.md)

## Routing Model

The live API is project-based.

Main bases:

- `/api/v1/auth/*`
- `/api/v1/projects/*`
- `/api/v1/delivery/projects/:projectId/*`
- `/api/v1/agent/v1/*`
- `/api/v1/system/*`
- `/api/v1/webhooks/*`

## The Main Content Read Bases

The first distinction to make is between:

- published REST delivery
- published GraphQL delivery
- branch-aware preview

Canonical bases:

- published REST: `/api/v1/delivery/projects/:projectId/collections/*`
- published GraphQL: `/api/v1/delivery/projects/:projectId/graphql`
- preview: `/api/v1/projects/:projectId/preview/*`

Management GraphQL is separate:

- `/api/v1/projects/:projectId/graphql/*`

## Current Route Families

### Health

- `GET /health`

### Authentication

Mounted from `packages/api/src/auth/routes.ts`.

This is the human-auth surface for:

- registration
- login
- refresh
- logout
- current-user lookup
- user preferences
- GitHub OAuth

See:

- [api/auth.md](./api/auth.md)

### Projects

Mounted from:

- `packages/api/src/projects/project-routes.ts`
- `packages/api/src/projects/member-routes.ts`
- `packages/api/src/projects/git-config-routes.ts`
- `packages/api/src/projects/branch-mapping-routes.ts`
- `packages/api/src/projects/delivery-key-routes.ts`
- `packages/api/src/projects/workspace-routes.ts`

This family covers:

- project CRUD
- members and agent members
- Git credential configuration
- branch mappings
- delivery-key generation and revocation
- workspace catalog and UI-group management

### Project Sub-Routes

Mounted under `/api/v1/projects/:projectId` from `packages/api/src/index.ts`.

Sub-families include:

- `/git`
- `/assets`
- `/global-assets`
- `/preview`
- `/builds`
- `/cdn`
- `/content-types`
- `/collections`
- `/resources`
- `/locks`
- `/graphql`
- `/plugins`

### Delivery

Mounted from:

- `packages/api/src/collections/public-routes.ts`
- `packages/api/src/graphql/delivery-routes.ts`

Delivery routes are for published content reads, not operational project management.

Main families:

- `/api/v1/delivery/projects/:projectId/collections/*`
- `/api/v1/delivery/projects/:projectId/graphql`

### Agent Gateway

Mounted from:

- `packages/api/src/agent-gateway/public-routes.ts`
- `packages/api/src/agent-gateway/write-routes.ts`
- `packages/api/src/agent-gateway/admin-routes.ts`

Main base:

- `/api/v1/agent/v1/*`

This family covers:

- bootstrap and status
- schemas and structure
- history
- collection entry reads
- guarded mutations
- admin config, token, consent, and audit routes
- raw file reads
- diagnostics

See:

- [../agents/api-reference.md](../agents/api-reference.md)

### System

Mounted from `packages/api/src/system/routes.ts`.

Current public system route:

- `/api/v1/system/status`

### Resources

Mounted from `packages/api/src/resources/routes.ts` under `/api/v1/projects/:projectId/resources/*`.

This family covers:

- resource collection list and detail reads
- per-resource schema and policy reads
- resource record list and detail reads

### Webhooks

Mounted from `packages/api/src/webhooks/routes.ts`.

This family covers inbound provider webhooks and related verification paths.

## How To Read This Repository

If you need the exact current route surface, use this order:

1. this overview for the route family
2. the specific reference page for that family
3. the mounted router file in `packages/api/src`

That order is more reliable than treating one prose page as a full endpoint index.

## Related Docs

- [content-delivery.md](./content-delivery.md)
- [graphql-delivery.md](./graphql-delivery.md)
- [preview-and-delivery.md](./preview-and-delivery.md)
- [webhooks.md](./webhooks.md)
- [builds-and-cdn.md](./builds-and-cdn.md)
- [api/auth.md](./api/auth.md)

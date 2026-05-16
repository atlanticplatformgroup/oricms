# OriCMS Packages

Monorepo packages for the current OriCMS codebase.

## Present in This Checkout

| Package | Description | Status |
|---------|-------------|--------|
| `api` | Express + Prisma backend | Active |
| `web` | React admin app | Active |
| `shared` | Shared types/contracts | Active |
| `cli` | CLI tooling | Active |
| `client` | TypeScript SDK (`@oricms/client`) | Active |
| `adapters/astro` | Astro adapter | Active |
| `adapters/nextjs` | Next.js adapter | Active |

## API Shape Used by Packages

- The main web app and API are project-based: `/api/v1/projects/:projectId/...`
- The agent gateway is mounted at `/api/v1/agent/v1/...`
- The checked-in TypeScript client package accepts `projectId` as the canonical identifier and still carries a deprecated `siteId` compatibility alias

## Client SDK Example

```ts
import { createClient } from '@oricms/client';

const cms = createClient({
  apiUrl: 'https://cms.example.com',
  projectId: 'project-id',
});

const posts = await cms.collections.list('blog-posts');
```

## CLI and Adapter Notes

- The CLI is in-repo and usable.
- The Astro and Next.js adapters are the first-class framework integrations currently present here.
- The TypeScript SDK still includes a deprecated `siteId` compatibility layer for older callers, but new code should use `projectId`.

# Package Map

Use this page to orient yourself in the OriCMS monorepo.

## Core Runtime Packages

- `packages/api`
  - package name: `@ori/api`
  - Express + Prisma backend
  - management API, delivery routes, agent gateway, plugin runtime, locks, and webhooks
- `packages/web`
  - package name: `@ori/web`
  - React + Vite admin application
  - workspace editing UI, schema/media/settings/members flows
- `packages/shared`
  - package name: `@ori/shared`
  - shared contracts, Zod-based validation, permission model, and shared utility types

## Consumer and Tooling Packages

- `packages/client`
  - package name: `@oricms/client`
  - compatibility-oriented TypeScript SDK
- `packages/cli`
  - package name: `@oricms/cli`
  - local CLI for auth, project helpers, export, and deploy-related commands

## Frontend Adapter Packages

- `packages/adapters/astro`
  - package name: `@oricms/astro`
- `packages/adapters/nextjs`
  - package name: `@oricms/nextjs`

These adapter packages live in the repository and are included by the root workspace globs in [`package.json`](../../package.json).

When you use npm workspace flags, use the package name rather than the folder path. For example:

```bash
npm run test -w @ori/api
npm run build -w @ori/web
npm run build -w @oricms/client
```

## Support Areas

- `docs`
  - canonical repository documentation
- `examples`
  - runnable or copyable integration examples

## Recommended Mental Model

For most cross-package feature work:

1. `packages/shared` defines the contract
2. `packages/api` enforces and serves it
3. `packages/web` consumes it

For adapter and integration work:

1. content model and repo shape come from the core product
2. adapter packages read that shape
3. examples and package-level tests show the supported integration path

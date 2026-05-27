# @ori/api

Express + Prisma backend for the current OriCMS product.

## Current Role

This package is the main server-side application. It owns:

- auth and membership flows
- project-scoped content and schema APIs
- Git-backed repository workflows
- builds, CDN, resources, locks, and agent gateway endpoints

## Common Commands

```bash
npm run dev -w @ori/api
npm run build -w @ori/api
npm run type-check -w @ori/api
npm run lint -w @ori/api
npm run test -w @ori/api
```

Database helpers:

```bash
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:verify-migrations -w @ori/api
npm run db:studio -w @ori/api
```

## Source of Truth

For the live backend surface, prefer:

- `src/index.ts`
- `src/**/*.ts`
- `/docs/reference/api/`

For repo-wide validation, prefer the root `npm run verify` flow.

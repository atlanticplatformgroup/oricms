# OriCMS Agent Guide

This file gives coding agents a short, current map of the OriCMS repository.

## Product Model

OriCMS is a project-centric, Git-backed CMS.

Current rules that matter across the codebase:

- `project` is the primary tenancy boundary
- the repository is the source of truth for collections, schemas, entries, and assets
- collections are the universal content model
- humans and AI agents share one membership and permission model
- the current stored workflow values are `draft` and `published`
- the UI label `Ready` maps to stored value `published`

Do not reintroduce:

- `site` as the primary product term
- legacy Pages/Singles distinctions
- separate permission systems for humans vs agents
- agent access tiers

Recent removals that should stay removed unless there is an explicit product decision to bring them back:

- starter workflows
- playground labs
- separate `packages/agent` on-prem service package
- built-in monitoring stack
- built-in edge / nginx deployment layer
- root `public/`, `infrastructure/`, and `scripts/` directories
- root app-scaffold config files such as `vite.config.ts` and `vitest.config.ts`

## Main Packages

- `packages/api`: Express + Prisma backend
- `packages/web`: React + Vite admin app
- `packages/shared`: shared contracts, types, and validation
- `packages/client`: TypeScript client SDK
- `packages/cli`: CLI tooling
- `packages/adapters/astro`: Astro integration
- `packages/adapters/nextjs`: Next.js integration

## API Shape

The live API is project-based:

- management routes: `/api/v1/projects/*`
- delivery routes: `/api/v1/delivery/projects/:projectId/*`
- agent gateway: `/api/v1/agent/v1/*`

Important API principles:

- auth and permission checks happen in middleware
- routes should stay thin
- application services own mutation orchestration
- shared contracts should come from `@ori/shared`, not direct cross-package source imports

## Web App Shape

The active admin UI uses:

- Mantine
- TanStack Query
- React Router

Prefer the current workspace/provider model over prop drilling. The codebase has been moving state into:

- `packages/web/src/contexts`
- `packages/web/src/contexts/workspace`
- `packages/web/src/hooks`

Do not assume older Radix/Tailwind guidance is current.

Package-local build and test config is canonical. Do not recreate root-level app scaffold configs when the active config already lives under a package directory.

## Permissions

The current permission model is resource/action based.

Resources:

- `schemas`
- `assets`
- `settings`
- `members`
- `agents`
- `contentTypes`
- `collections`

Actions:

- `create`
- `read`
- `update`
- `delete`
- `publish`

Shared roles:

- `owner`
- `admin`
- `editor`
- `viewer`

Agents use the same project roles as humans. Additional agent restrictions such as allowed branches and allowed collections are operational constraints, not a separate authorization model.

## Workflow

Current editorial workflow is intentionally simple:

- new entries default to `draft`
- publish-ready entries are stored as `published`
- preview is branch-aware
- routine entry editing uses optimistic concurrency
- destructive or structural flows use stronger coordination and locks where needed

For agent mutations, expect:

- bootstrap first
- preflight before risky writes
- idempotency support
- delete confirmation
- stale-revision checks

## Repository Layout

Current project repositories are collections-native:

```text
repo/
├── oricms/
│   └── collections.json
├── schemas/
│   └── types/
│       └── *.json
├── content/
│   └── <collection-path>/
│       └── <entryId>.json
└── assets/
```

Legacy `content/pages` paths may exist as compatibility paths in some integrations, but they are not the main product model.

## Local Development

Standard root workflow:

```bash
nvm use
npm install
docker-compose up -d postgres
npm run build -w @ori/shared
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:seed -w @ori/api
npm run dev
```

Main verification path:

```bash
npm run verify
```

Useful package-level checks:

```bash
npm run type-check -w @ori/api
npm run test -w @ori/api
npm run build:check -w @ori/web
npm run test -w @ori/web
npm run build -w @ori/shared
```

## Contribution Expectations

- keep terminology current
- prefer small, coherent changes
- update docs when behavior changes
- verify at the narrowest useful scope first, then broaden when needed
- do not preserve duplicate architectures when the repo already has a canonical path

## Canonical Docs

Use the docs tree as the source of truth for current product and repository guidance:

- `docs/README.md`
- `docs/architecture/overview.md`
- `docs/product/permissions-model.md`
- `docs/product/workflow-model.md`
- `docs/developer/local-development.md`
- `docs/developer/testing.md`

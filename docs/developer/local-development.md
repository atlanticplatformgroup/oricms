# Local Development

Use this guide when you are setting up a new OriCMS worktree or returning to local development after the environment has drifted.

## Runtime Requirements

- Node.js 20+ (use `.nvmrc` if you use nvm)
- npm 10+
- Docker
- Git

## Repository Shape

The repository is a workspace monorepo with the main product code under `packages/`.

Current package layout:

- `packages/api`: Express + Prisma backend
- `packages/web`: React + Vite admin app
- `packages/shared`: shared contracts and validation
- `packages/client`: TypeScript client SDK
- `packages/cli`: CLI tooling

## First-Time Setup

From the repo root:

```bash
nvm use
npm install
cp .env.example .env
cp packages/api/.env.example packages/api/.env
docker-compose up -d postgres
npm run build -w @ori/shared
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:verify-migrations -w @ori/api
```

If `docker-compose up -d postgres` reports that `oricms-postgres` already exists, inspect the existing container before deleting anything:

```bash
docker ps -a --filter name=oricms-postgres
```

If it is an old stopped local container that you no longer need, remove it and start Postgres again:

```bash
docker rm oricms-postgres
docker-compose up -d postgres
```

For normal local development, do not start the compose `api` or `web` services if you also plan to run `npm run dev`. They use the same local ports.

Then start the development servers:

```bash
npm run dev
```

Default local URLs:

- web app: `http://localhost:5173`
- API: `http://localhost:3001`

## Fresh Worktree Setup

Git worktrees share repository history but do not share ignored local runtime files.

For a fresh worktree, expect to restore:

- root `.env`
- `packages/api/.env`
- local database connection settings such as `DATABASE_URL`
- API secrets such as `JWT_SECRET` and `ENCRYPTION_KEY`
- generated artifacts such as Prisma client output

Minimum recovery steps for a fresh worktree:

```bash
nvm use
npm install
npm run build -w @ori/shared
npm run db:generate -w @ori/api
```

If the API starts but Prisma-backed routes fail immediately, check environment variables first.

## Day-to-Day Commands

From the repo root:

```bash
# Run API + web together
npm run dev

# Run the API only
npm run dev:api

# Run the web app only
npm run dev:web

# Build the web app and shared package
npm run build

# Full verification pass
npm run verify
```

Package-level commands you will use often:

```bash
npm run type-check -w @ori/api
npm run test -w @ori/api
npm run build:check -w @ori/web
npm run test -w @ori/web
npm run build -w @ori/shared
```

Useful repo and package maintenance scripts:

```bash
# Build every root-workspace package
npm run build:all

# Run lint across root-workspace packages
npm run lint

# Open Prisma Studio for the API package
npm run db:studio -w @ori/api
```

## Common Local Failures

### Shared imports fail

Rebuild the shared package:

```bash
npm run build -w @ori/shared
```

### Prisma client is stale or missing

Regenerate it:

```bash
npm run db:generate -w @ori/api
```

### The API test suite fails because the schema is out of date

Re-run the Prisma setup for the current worktree:

```bash
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:verify-migrations -w @ori/api
```

### Only one package seems broken

Run the package-local command instead of the full root workflow first. That usually makes failures easier to isolate.

## Local Development Expectations

- prefer root scripts when you want the standard repo workflow
- prefer package scripts when you are isolating a failure
- do not assume ignored env files exist in every worktree
- rebuild `@ori/shared` whenever downstream packages stop seeing current types

## Related Docs

- [testing.md](./testing.md)
- [package-map.md](./package-map.md)
- [../contributor/releases.md](../contributor/releases.md)
- [../contributor/documentation-standards.md](../contributor/documentation-standards.md)

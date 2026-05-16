# OriCMS Quickstart

This guide gets a local OriCMS stack running and verifies that the main surfaces are alive.

## Requirements

- Node.js 20+
- npm 10+
- Docker
- Git

## Install Dependencies

From the repository root:

```bash
nvm use
npm install
```

## Copy the Local Environment Files

Create both local env files before you start the stack:

```bash
cp .env.example .env
cp packages/api/.env.example packages/api/.env
```

For a normal local setup, make sure `packages/api/.env` has at least:

- `DATABASE_URL=postgresql://oricms:oricms@localhost:5432/oricms`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

The root `.env` is for repo-level web and compose settings such as `VITE_API_URL` and `VITE_GITHUB_CLIENT_ID`.

## Start Supporting Services

```bash
docker-compose up -d postgres
```

For local development, do **not** start the `api` and `web` compose services if you plan to run `npm run dev`. Those services bind the same ports.

## Prepare the API Workspace

```bash
npm run build -w @ori/shared
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:verify-migrations -w @ori/api
npm run db:seed -w @ori/api
```

## Run the App

```bash
npm run dev
```

Default local URLs:

- admin app: `http://localhost:5173`
- API: `http://localhost:3001`

## Verify the Main Surfaces

After the app starts:

1. Open the admin app.
2. Sign in or create an account.
3. Create or open a project.
4. Make sure these workspace areas load:
   - Collections
   - Schemas
   - Media
   - Builds
   - Settings
   - Members

If those screens load cleanly, the local stack is in a good enough state to keep going.

## Common First-Run Problems

### Prisma-backed routes fail immediately

Make sure the worktree has the required environment files and database settings:

- `.env`
- `packages/api/.env`
- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

Fresh worktrees do not carry ignored env files forward automatically.

### Shared package imports fail

Rebuild the shared package:

```bash
npm run build -w @ori/shared
```

### Prisma client is missing

Regenerate it:

```bash
npm run db:generate -w @ori/api
```

## Next

- [Core Concepts](./core-concepts.md)
- [Create Your First Project](./first-project.md)
- [First Publish](./first-publish.md)

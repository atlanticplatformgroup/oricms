# @ori/web

React admin application for the current OriCMS product.

## Current Role

This package is the main browser UI. It owns:

- onboarding and authentication flows
- project workspaces for collections, schemas, media, settings, members, and builds
- editor and structured content authoring surfaces
- the client-side shell around the project-scoped API

## Common Commands

```bash
npm run dev -w @ori/web
npm run build -w @ori/web
npm run build:check -w @ori/web
npm run type-check -w @ori/web
npm run lint -w @ori/web
npm run test -w @ori/web
```

E2E helpers:

```bash
npm run test:e2e -w @ori/web
npm run test:e2e:fullstack -w @ori/web
npm run test:e2e:headed -w @ori/web
```

## Source of Truth

For the live UI surface, prefer:

- `src/App.tsx`
- `src/components/**`
- `src/hooks/**`
- `/docs/features/`

For deployment packaging, note that the web image still serves production assets through the package-local `nginx.conf`.

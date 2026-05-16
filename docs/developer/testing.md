# Testing

Use this guide to decide which checks to run before, during, and after a change.

## Default Verification Path

The standard root verification command is:

```bash
npm run verify
```

Current behavior:

- lints all workspaces
- builds all workspaces
- type-checks `@ori/api`
- verifies Prisma migration history against `packages/api/prisma/schema.prisma`
- runs `@ori/web` build + type-check
- runs all workspace tests

Use this when you need confidence across the active product surfaces.

## Fast Package-Level Checks

For targeted changes, prefer the narrowest useful check first.

### Shared

```bash
npm run build -w @ori/shared
```

### API

```bash
npm run type-check -w @ori/api
npm run test -w @ori/api
```

### Web

```bash
npm run build:check -w @ori/web
npm run test -w @ori/web
```

The standard browser smoke suite uses mocked API responses and is intentionally
fast:

```bash
npm run test:e2e -w @ori/web
```

Use the full-stack browser target when setup, authentication, project creation,
or API wiring is in scope:

```bash
npm run test:e2e:fullstack -w @ori/web
```

### Client

```bash
npm run test -w @oricms/client
```

### CLI

```bash
npm run build -w @oricms/cli
```

## Choosing the Right Scope

### Docs-only change

No code tests are required unless the doc change depends on verified runtime behavior you have not already checked.

### Single-package implementation change

Run the package-local type-check/test workflow first.

### Cross-package contract change

At minimum, run:

```bash
npm run build -w @ori/shared
npm run type-check -w @ori/api
npm run build:check -w @ori/web
```

### Infrastructure or release-sensitive change

Run the full root verify pass.

## Testing Philosophy

- use the smallest check that can falsify your assumption quickly
- finish with broader verification when the change crosses package boundaries
- treat `build:check` as part of the web verification path, not just a production build step
- prefer fixing flaky tests to working around them

## When Tests Fail

Start by narrowing the failure:

1. rerun the package-local command
2. rerun the specific test file if the package uses file-level selection
3. check for stale Prisma client, stale shared build output, or missing env

Common examples:

- API type failures after shared contract changes: rebuild `@ori/shared`
- Prisma/runtime failures: regenerate the client and verify env
- web failures after API contract changes: rerun web build/type-check after shared/API fixes

## Minimum Expectations Before Commit

The minimum bar depends on the change, but contributors should usually be able to say one of:

- `docs-only, no runtime checks needed`
- `package-local checks passed`
- `full verify passed`

Do not leave verification implicit.

## Related Docs

- [local-development.md](./local-development.md)
- [package-map.md](./package-map.md)
- [../contributor/documentation-standards.md](../contributor/documentation-standards.md)

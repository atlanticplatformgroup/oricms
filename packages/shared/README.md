# @ori/shared

Shared contracts and utilities used across OriCMS packages.

## Current Role

This package holds the common primitives that multiple packages rely on, including:

- shared types and validation
- project settings normalization
- schema and collection helper utilities
- common content-model helpers used by API, web, client, and adapters

## Common Commands

```bash
npm run build -w @ori/shared
npm run type-check -w @ori/shared
npm run lint -w @ori/shared
npm run test -w @ori/shared
```

## Source of Truth

For the active contract surface, prefer:

- `src/index.ts`
- `src/types.ts`
- `src/validation.ts`

If a package boundary depends on a shared shape, this package is the place to check first.

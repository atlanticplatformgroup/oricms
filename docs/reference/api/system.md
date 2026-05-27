# System API

Use the system API for public instance status checks.

## Base Route

```text
/api/v1/system/*
```

## Current Surface

- `GET /status`

## What This Route Does

The current public system route reports whether the instance still needs initial setup.

Current response fields include:

- `needsSetup`
- `hasOwner`
- `hasProjects`

## Related Docs

- [../api-overview.md](../api-overview.md)

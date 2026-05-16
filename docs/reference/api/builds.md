# Builds API

Use the builds API for build records and environment-related build behavior.

## Current Surface

- build list and filtered status views
- single-build inspection
- manual build triggering
- build cancellation
- worker-facing build status updates
- lightweight project build-status summary
- related CDN export history through the project CDN routes

Current build statuses are:

- `pending`
- `running`
- `success`
- `failed`
- `cancelled`

## Related Docs

- [../builds-and-cdn.md](../builds-and-cdn.md)
- [../../configuration/deployment-and-build-hooks.md](../../configuration/deployment-and-build-hooks.md)

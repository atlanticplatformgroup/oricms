# CDN API

Use the CDN API for project-scoped export configuration and export-job lifecycle work.

## Base Route

```text
/api/v1/projects/:projectId/cdn/*
```

## Current Surface

- `GET /config`
- `POST /config`
- `DELETE /config`
- `POST /export`
- `GET /exports`
- `GET /exports/:exportId`

## What These Routes Do

The CDN routes cover three jobs:

- store and read project CDN configuration
- remove project CDN configuration
- trigger an export from a successful build output
- inspect export-job history and status

Current providers are:

- `s3`
- `r2`
- `minio`

Cloudflare support currently uses the `r2` provider path rather than a separate provider name.

## Export Behavior

Exports are tied to build output, not direct entry mutations.

- if `buildId` is provided, the export uses that build output
- otherwise the API uses the latest successful build with an output path

Current export statuses are:

- `pending`
- `uploading`
- `invalidating`
- `completed`
- `failed`

## Related Docs

- [../builds-and-cdn.md](../builds-and-cdn.md)
- [builds.md](./builds.md)

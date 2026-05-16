# Builds and CDN

Use this page when you need the deployment-oriented surfaces in one place.

## Builds

The builds surface tracks deployment-oriented work for a project.

Current build routes are mounted under:

- `/api/v1/projects/:projectId/builds`

Current build behavior includes:

- listing build records
- reading a build by id
- manually triggering a build
- cancelling pending or running builds
- worker-side status updates

Current build statuses are:

- `pending`
- `running`
- `success`
- `failed`
- `cancelled`

Builds are not the same thing as ordinary entry saves. They represent downstream deployment or export work after content has already changed.

## CDN and Export

The CDN/export surface is mounted under:

- `/api/v1/projects/:projectId/cdn/*`

This covers:

- CDN configuration
- export execution
- export-job history and status

Current storage providers are:

- `s3`
- `r2`
- `minio`

Cloudflare support currently lives through the `r2` provider path rather than a separate `cloudflare` provider name.

Current export statuses are:

- `pending`
- `uploading`
- `invalidating`
- `completed`
- `failed`

## Environment Hooks

Environment hooks are related but separate:

- build webhooks
- revalidation webhooks
- preview/live environment URLs

## Important Distinction

- entry mutation changes repository state
- builds/export routes turn repository state into deployed output

That is the split to keep in mind when content looks correct in OriCMS but wrong in a deployed site.

## Related Docs

- [api/cdn.md](./api/cdn.md)
- [api/builds.md](./api/builds.md)
- [preview-and-delivery.md](./preview-and-delivery.md)
- [webhooks.md](./webhooks.md)
- [../guides/builds-and-revalidation.md](../guides/builds-and-revalidation.md)

# Resources API

Use the resources API for project-scoped resource collection, schema, policy, and record reads.

## Base Route

```text
/api/v1/projects/:projectId/resources/*
```

## Current Surface

- `GET /`
- `GET /:resourceCollectionId`
- `GET /:resourceCollectionId/schema`
- `GET /:resourceCollectionId/policy`
- `GET /:resourceCollectionId/records`
- `GET /:resourceCollectionId/records/:recordId`

## What These Routes Do

This surface exposes the resource collections OriCMS makes available to authenticated project members, including:

- resource collection list and detail reads
- per-resource schema reads
- per-resource policy summary reads
- paginated record list and detail reads

Resources are management-mode reads, not delivery endpoints.

## Notes

- access is project-membership aware
- callers only see resource collections they can read
- record list responses are paginated with `page`, `limit`, `total`, and `pageCount`

## Related Docs

- [../api-overview.md](../api-overview.md)
- [settings.md](./settings.md)

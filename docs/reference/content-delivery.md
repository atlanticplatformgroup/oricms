# Content Delivery

Use this page when you need to understand where OriCMS content comes from and how to discover the correct REST or GraphQL endpoint.

## Start Here

OriCMS exposes three distinct read surfaces:

1. published REST delivery
2. published GraphQL delivery
3. branch-aware preview

The right starting point depends on what you are building:

- building a public frontend with predictable resource reads: start with published REST
- building a frontend or integration that wants shaped queries: start with published GraphQL
- inspecting draft, branch, or ref-specific content before publish: use preview

If you want the workflow version of this decision rather than the reference version, use:

- [../guides/building-a-headless-site.md](../guides/building-a-headless-site.md)

## Endpoint Discovery

### Published REST delivery

Base route:

```text
/api/v1/delivery/projects/:projectId/collections/:collectionId
```

Use this when you want:

- published collection lists
- published single-entry reads
- conventional REST resource access

Examples:

- `GET /api/v1/delivery/projects/:projectId/collections/posts`
- `GET /api/v1/delivery/projects/:projectId/collections/posts/hello-world`

See:

- [api/collections-and-entries.md](./api/collections-and-entries.md)

### Published GraphQL delivery

Base route:

```text
/api/v1/delivery/projects/:projectId/graphql
```

Use this when you want:

- published content reads through GraphQL
- delivery schema introspection
- shaped query responses for frontend consumers

Examples:

- `POST /api/v1/delivery/projects/:projectId/graphql`
- `GET /api/v1/delivery/projects/:projectId/graphql/schema`
- `GET /api/v1/delivery/projects/:projectId/graphql/schema/introspection`

See:

- [api/graphql.md](./api/graphql.md)
- [graphql-delivery.md](./graphql-delivery.md)

### Preview

Base route:

```text
/api/v1/projects/:projectId/preview
```

Use this when you want:

- draft reads
- branch-aware reads
- ref-specific reads
- preview validation

Examples:

- `GET /api/v1/projects/:projectId/preview/content`
- `GET /api/v1/projects/:projectId/preview/pages`
- `POST /api/v1/projects/:projectId/preview/validate`

See:

- [api/preview.md](./api/preview.md)

### Management GraphQL

Base route:

```text
/api/v1/projects/:projectId/graphql
```

This is not the same surface as published GraphQL delivery.

Use management GraphQL when you need:

- authenticated project-scoped GraphQL execution
- schema SDL
- schema snapshots
- persisted-query administration

See:

- [api/graphql.md](./api/graphql.md)

## How To Choose

### Choose published REST when:

- the frontend wants stable resource URLs
- you want straightforward HTTP caching behavior
- your consumers do not need query composition

### Choose published GraphQL when:

- the frontend wants shaped reads
- the frontend wants to avoid over-fetching
- the consumer already has a GraphQL integration model

### Choose preview when:

- the content is not published yet
- the user needs branch-aware content
- the request is for editorial preview rather than production delivery

## Delivery Authentication

Published delivery accepts either:

- `x-oricms-delivery-key: <key>`
- `Authorization: Bearer <key>`

If delivery-key enforcement is enabled for the project, one of those headers is required for published REST and published GraphQL reads.

If you are wiring a new headless frontend, verify the delivery contract directly before writing application code:

```bash
curl \
  -H "x-oricms-delivery-key: $ORICMS_DELIVERY_KEY" \
  "https://your-oricms.example.com/api/v1/delivery/projects/$ORICMS_PROJECT_ID/collections/$ORICMS_COLLECTION_ID"
```

That first check tells you quickly whether the project ID, collection ID, and delivery key are all valid.

## Current Source-of-Truth Model

OriCMS is Git-native.

Current behavior is:

- repository files are canonical for content, collections, and schemas
- PostgreSQL is canonical for operational metadata and access control
- published delivery reads from a revision-tracked PostgreSQL projection derived from the repository
- published delivery and preview are separate contracts
- the published projection currently tracks the project's default branch

For consumers, the important distinction is:

- published delivery is the consumer-facing contract
- preview is the draft- and branch-aware inspection surface

That means:

- authors and automation still mutate Git-backed content
- published REST and GraphQL read from the projected published state
- preview remains the direct branch-aware inspection surface

## How Published Delivery Stays Current

Published delivery is not a second authoring system. It is a derived read model.

Current behavior is:

- API writes update Git-backed content first
- after successful content, collection, content-type, or project-config mutations, OriCMS queues a delivery projection refresh
- published delivery requests also verify that the current default-branch revision has been projected before they read from PostgreSQL
- a periodic reconciler repairs drift if a background refresh was missed

That means:

- normal authoring through OriCMS updates published delivery through the projection path
- direct Git commits to the managed project repository are also picked up, because delivery checks the current repository revision before serving projected reads
- preview does not wait for projection, because it is still reading branch-aware repository state directly

## What This Means For Branches

Published delivery currently follows the project's default branch.

Use preview when you need:

- non-default branches
- draft or pre-publish inspection
- ref-specific checks during editorial work

Use published delivery when you need:

- the production-facing published contract
- stable REST or GraphQL reads for consumers
- data that reflects the current projected state of the default branch

## Common Mistakes

### “I have a project ID, so I can use any GraphQL endpoint.”

No.

There are two GraphQL surfaces:

- management: `/api/v1/projects/:projectId/graphql`
- delivery: `/api/v1/delivery/projects/:projectId/graphql`

### “Preview is the same thing as published delivery.”

No.

Preview is intentionally branch-aware and draft-aware. Published delivery is the public content contract.

### “REST and GraphQL are separate products.”

No.

They are two delivery transports over the same product model:

- REST is the simpler resource surface
- GraphQL is the more flexible query surface

## Related Docs

- [../guides/building-a-headless-site.md](../guides/building-a-headless-site.md)
- [api-overview.md](./api-overview.md)
- [api/README.md](./api/README.md)
- [preview-and-delivery.md](./preview-and-delivery.md)
- [graphql-delivery.md](./graphql-delivery.md)

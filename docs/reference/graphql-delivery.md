# GraphQL Delivery

Use this page to understand the current GraphQL surface.

## Current Routes

Management and delivery GraphQL are distinct:

- management GraphQL: `/api/v1/projects/:projectId/graphql`
- schema route: `/api/v1/projects/:projectId/graphql/schema`
- delivery GraphQL: `/api/v1/delivery/projects/:projectId/graphql`

## Intended Use

Use delivery GraphQL when a frontend or integration needs flexible published-content reads.

Do not treat GraphQL as the only OriCMS API surface. Management and operational workflows still primarily use REST.

## Delivery Behavior

The delivery endpoint is project-scoped and can be protected by a delivery API key.

Current delivery behavior includes:

- published-content reads
- optional delivery key enforcement
- optional persisted-query allowlisting
- ETag and cache-control support for delivery responses
- query validation limits for size, depth, and cost

Current delivery auth headers:

- `x-oricms-delivery-key: <key>`
- `Authorization: Bearer <key>`

Preview and management workflows remain outside the delivery route.

## Project Settings Support

Project settings can store GraphQL delivery configuration such as delivery-key requirements and persisted-query metadata.

## Related Docs

- [../guides/building-a-headless-site.md](../guides/building-a-headless-site.md)
- [api/graphql.md](./api/graphql.md)
- [preview-and-delivery.md](./preview-and-delivery.md)
- [api-overview.md](./api-overview.md)

# GraphQL API

Use this page when you need the route-family view of GraphQL rather than the higher-level delivery overview.

If your first question is “which GraphQL endpoint should I use?”, the short answer is:

- public published reads: `/api/v1/delivery/projects/:projectId/graphql`
- authenticated project management: `/api/v1/projects/:projectId/graphql/*`

## Two GraphQL Surfaces

OriCMS exposes:

- a project-scoped management surface
- a delivery surface for published-content reads

## Management Base Route

```text
/api/v1/projects/:projectId/graphql/*
```

Current management routes include:

- `GET /schema`
- `GET /schema/snapshots`
- `POST /schema/snapshots`
- `GET /schema/snapshots/:version`
- `GET /schema/introspection`
- `GET /persisted-queries`
- `PUT /persisted-queries`
- `POST /`

This surface is for authenticated project members. It handles:

- schema SDL inspection
- schema snapshot registry management
- introspection
- persisted-query administration
- direct project-scoped GraphQL execution

## Delivery Base Route

```text
/api/v1/delivery/projects/:projectId/graphql
```

Current delivery routes are:

- `POST /`
- `GET /schema`
- `GET /schema/introspection`

Delivery GraphQL is published-only and can be protected by a delivery API key. It also supports persisted-query allowlisting through project settings.

## Important Distinction

- management GraphQL is a workspace/admin surface
- delivery GraphQL is for published frontend and integration reads

Do not assume that a query allowed on the management surface belongs in the delivery contract.

## Related Docs

- [../content-delivery.md](../content-delivery.md)
- [../graphql-delivery.md](../graphql-delivery.md)
- [../preview-and-delivery.md](../preview-and-delivery.md)

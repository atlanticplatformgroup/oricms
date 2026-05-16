# Preview and Delivery

Use this page when you need the line between preview and delivery to be unambiguous.

If you are trying to discover the exact endpoint family first, start with:

- [content-delivery.md](./content-delivery.md)

## Preview

Preview is for inspecting branch-aware repository state before a change is treated as live.

Preview can include:

- draft entries
- branch-specific changes
- unpublished editorial work

## Delivery

Delivery is for consumers that should read the published view of content.

Current delivery surfaces:

- REST delivery routes
- GraphQL delivery routes

Published delivery now reads from a revision-tracked PostgreSQL projection derived from the repository's default branch. Preview still reads repository state directly so it can stay branch-aware and draft-aware.

## Important Distinction

Preview and delivery are related but not interchangeable.

- preview helps teams inspect work in progress
- delivery is the contract consumed by frontends and integrations
- preview is direct repository inspection
- delivery is the projected published read model

That distinction matters in practice. A frontend can be “showing the wrong thing” because it is looking at published delivery when the editor is inspecting preview, or vice versa.

## Frontend Integrations

Astro and Next.js can use preview-aware local development while published builds consume published output only.

## Related Docs

- [content-delivery.md](./content-delivery.md)
- [api/preview.md](./api/preview.md)
- [api/graphql.md](./api/graphql.md)
- [graphql-delivery.md](./graphql-delivery.md)
- [builds-and-cdn.md](./builds-and-cdn.md)
- [../guides/builds-and-revalidation.md](../guides/builds-and-revalidation.md)

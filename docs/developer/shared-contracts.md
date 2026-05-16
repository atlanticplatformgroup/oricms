# Shared Contracts

Use this page when a change crosses package boundaries.

OriCMS is easiest to extend when the contract changes in one place first, then flows outward:

1. `packages/shared` defines the type, validation, and permission contract
2. `packages/api` enforces and serves that contract
3. `packages/web` consumes it
4. adapter packages read the resulting project/repo shape

## Start In `packages/shared`

Add or update shared contracts in:

- `packages/shared/src/types.ts`
- `packages/shared/src/validation.ts`
- `packages/shared/src/field-capabilities.ts`
- `packages/shared/src/plugin-events.ts`

Use `packages/shared` for:

- API request and response shapes
- agent mutation result types
- lock and revision contracts
- field and schema types
- plugin event names
- permission resources and actions

Do not define the same contract independently in API and web.

## Then Update API

Once the shared contract exists, wire it through:

- route validation
- service or application-layer behavior
- persistence shape if needed
- canonical response helpers

For backend changes, prefer:

- high-level domain operations under `packages/api/src/application`
- route-family helpers under `packages/api/src/lib`
- shared permission middleware instead of route-specific role checks

Avoid putting new behavior only in an Express route if the same semantics should also apply to GraphQL, agent writes, or future consumers.

## Then Update Web

The web app should consume shared contracts instead of redefining them.

Typical places:

- `packages/web/src/lib/api`
- `packages/web/src/hooks/queries`
- workspace contexts and feature hooks
- field and workspace registries

If a UI feature depends on new API data, update the shared response type first and import that type into the web package.

## Then Verify Adapters and Examples

If the change affects repo shape, preview semantics, or delivery output, also verify:

- `packages/adapters/astro`
- `packages/adapters/nextjs`
- `examples/nextjs-app-router-entry-page.tsx`
- package-level tests and fixture coverage

This is especially important for:

- entry status behavior
- collection path changes
- schema format changes
- new published or preview rules

## Contract Hygiene Rules

- Prefer additive changes over silent breaking changes.
- Keep permission and workflow semantics in shared types when both humans and agents rely on them.
- Keep API envelopes canonical. Do not introduce one-off response shapes for a single route.
- Put terminology changes in the glossary and product docs once the code changes land.

## Related Docs

- [package-map.md](./package-map.md)
- [extending-fields.md](./extending-fields.md)
- [extending-backend.md](./extending-backend.md)
- [building-adapters.md](./building-adapters.md)

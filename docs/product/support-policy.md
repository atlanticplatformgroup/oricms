# Support Policy

Use this page to understand what OriCMS should present as first-class, what it should treat as current but limited, and what it should stop advertising as the main model.

## Current Support Tiers

### First-Class

These areas are part of the active product surface and should be treated as current:

- project-based management API
- collections-native repository model
- web admin app
- REST and GraphQL delivery surfaces
- agent gateway
- Astro integration
- Next.js integration

### Current but Curated

These are current, but contributors should not overstate them:

- checked-in OpenAPI docs are curated snapshots, not exhaustive generated specs
- contributor and product docs are current, but some repo-level files are still less canonical than the docs tree

### Compatibility Paths

These paths still exist for compatibility but should not be presented as the main product model:

- legacy `content/pages` repository shape in integrations
- older terminology like `site`

Compatibility support should not drive new product language or new design decisions.

## What Not to Promise

Do not describe these as first-class current support unless the code and docs are updated to match:

- unreleased adapters
- historical agent tier models
- legacy page-model workflows
- infrastructure-per-tenant isolation
- fully generated exhaustive API specifications

If something needs a disclaimer every time it is mentioned, it is probably not first-class support.

## Documentation Policy

Current docs should describe:

- what is live
- what is current but limited
- what is compatibility-only

They should not preserve obsolete models just because they existed earlier in development.

## Contribution Policy

When contributors add or change features:

- update the current docs if behavior changed
- avoid introducing legacy terminology into new docs
- avoid labeling an integration as first-class unless it has a real maintained path

## References

- [feature-map.md](./feature-map.md)
- [compatibility-policy.md](./compatibility-policy.md)
- [../reference/integration-support-matrix.md](../reference/integration-support-matrix.md)
- [../integrations/astro.md](../integrations/astro.md)
- [../integrations/nextjs.md](../integrations/nextjs.md)

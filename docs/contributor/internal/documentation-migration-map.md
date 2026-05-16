# OriCMS Documentation Migration Map

This document maps the current documentation set to the target architecture defined in [ideal-documentation-outline.md](./ideal-documentation-outline.md).

It is the bridge between:
- the current documentation inventory
- the desired long-term documentation structure

## Executive Summary

The current docs have three main issues:

1. Top-level sprawl
- Too many unrelated docs live directly under `docs/`
- Users cannot infer which files are canonical

2. Mixed document intent
- Overviews, runbooks, reference docs, historical notes, and design notes are interleaved
- Several files combine concept, guide, and reference material in one place

3. Historical drift
- Some docs describe older product models that are no longer true
- The clearest example is the old tier-based agent model

## Proposed Target Structure

```text
docs/
  README.md
  getting-started/
  guides/
  integrations/
    astro/
    nextjs/
  reference/
  operations/
  architecture/
  extensions/
  product/
  contributor/
```

## Migration Rules

Use these actions consistently:

- `keep`
  - document is already in the right place and mostly accurate
- `move`
  - document is good but belongs in a different section
- `merge`
  - document should be folded into another canonical document
- `rewrite`
  - document topic is still needed, but current content is not reliable enough
- `delete`
  - no longer useful once replacement exists

## Current Inventory Mapping

### Root-Level Product and Status Docs

#### `/README.md`
- Action: `keep`, then tighten
- Target home: repository root
- Role: repo landing page, quick start, high-level product summary
- Notes:
  - should stay short
  - should point into `docs/` for everything deeper

#### `/FEATURES.md`
- Action: `delete`
- Target home: `docs/product/feature-map.md`
- Notes:
  - replaced by the maintained product doc at `docs/product/feature-map.md`
  - root-level duplicate should not remain

#### `/ROADMAP.md`
- Action: `delete`
- Target home: none
- Notes:
  - remove root planning artifact from the canonical docs surface

#### `/TASKS.md`
- Action: `delete`
- Target home: none
- Notes:
  - remove root execution tracker from the canonical docs surface

#### `/DOCUMENTATION_INDEX.md`
- Action: `delete`
- Target home: none
- Notes:
  - superseded by `docs/README.md`

## Current `docs/` Files

### `docs/README.md`
- Action: `rewrite`
- Target home: `docs/README.md`
- Future role:
  - canonical docs homepage
  - routes readers by audience and task
- Current issue:
  - functions more like a status/index note than a clear docs entrypoint

### `docs/API.md`
- Action: `move` and `split`
- Target home:
  - `docs/reference/api-rest.md`
  - possibly `docs/reference/api-overview.md`
- Current issue:
  - useful as an API entrypoint
  - too broad for a single file

### `docs/ACCESSIBILITY.md`
- Action: `move`
- Target home: `docs/product/accessibility.md` or `docs/contributor/accessibility.md`
- Placement rule:
  - if this is about product accessibility guarantees, put it under `product/`
  - if it is mostly implementation guidance, put it under `contributor/`

### `docs/OPERATIONS.md`
- Action: `move` and `split`
- Target home:
  - `docs/operations/README.md`
  - plus topic runbooks under `docs/operations/`
- Current issue:
  - runbook belongs in an operations section, not top-level

### `docs/deployment.md`
- Action: `move`
- Target home: `docs/operations/deployment.md`

### `docs/migrations.md`
- Action: `move`
- Target home: `docs/guides/migrations.md`
- Notes:
  - this is a user task guide, not top-level reference

### `docs/GLOSSARY.md`
- Action: `move`
- Target home: `docs/reference/glossary.md`

### `docs/CHANGELOG.md`
- Action: `move`
- Final target home: removed
- Notes:
  - changelog is maintainer-facing historical material, not navigational product docs

### `docs/DOC_STATUS.md`
- Action: `delete`
- Notes:
  - already marked historical

### `docs/code-review-fixes.md`
- Action: `delete`

### `docs/agent-write-design.md`
- Action: `delete`
- Notes:
  - design artifact, not user documentation

### `docs/plugin-hook-signing.md`
- Action: `move`
- Target home: `docs/extensions/plugin-hook-signing.md`

### `docs/plugin-system-runbook.md`
- Action: `move`
- Target home: `docs/operations/plugin-system-runbook.md`

### `docs/openapi.yaml`
- Action: `keep`
- Final target home: `docs/openapi.yaml`
- Notes:
  - remains a curated current snapshot rather than a generated exhaustive spec

### `docs/openapi-schemas.yaml`
- Action: `delete`
- Reason:
  - redundant loose schema fragment
  - older page-model terminology
  - `docs/openapi.yaml` is now the single current OpenAPI artifact

## Current `docs/agents/`

This directory is valuable but needs consolidation.

### `docs/agents/overview.md`
- Action: `move`
- Target home: `docs/guides/agents/overview.md` or `docs/product/agents.md`
- Preferred:
  - `guides/agents/overview.md` if it is primarily onboarding and usage

### `docs/agents/api-reference.md`
- Action: `move`
- Target home: `docs/reference/agent-api.md`

### `docs/agents/authentication.md`
- Action: `merge`
- Target home:
  - `docs/reference/agent-api.md`
  - and/or `docs/reference/authentication.md`
- Notes:
  - auth should not be split off unless it is large enough to justify a canonical auth reference section

### `docs/agents/example-agent.md`
- Action: `move`
- Target home: `docs/guides/agents/example-agent.md`

### `docs/agents/pii-redaction.md`
- Action: `move`
- Target home:
  - `docs/product/agent-safety.md`
  - or `docs/architecture/agents.md` if described as system behavior
- Notes:
  - probably should be merged into a broader agent safety/behavior document

### `docs/agents/tiered-access.md`
- Action: `delete`
- Reason:
  - product model is no longer tier-based
  - this is actively misleading if kept as current documentation

## Current `docs/api/`

### `docs/api/authentication.md`
- Action: `move`
- Target home: `docs/reference/authentication.md`
- Notes:
  - this should likely be the canonical auth reference for the management API

## Current `docs/features/`

### `docs/features/agent-gateway.md`
- Action: `rewrite`
- Target home:
  - `docs/architecture/agents.md`
  - plus `docs/reference/agent-api.md`
  - plus `docs/product/agents.md`
- Reason:
  - current copy still references tiered access and read-only assumptions
  - the topic is still essential, but the current document is no longer trustworthy

## Current `docs/architecture/`

This directory is the healthiest part of the current docs structure.

### `docs/architecture/overview.md`
- Action: `keep`
- Target home: `docs/architecture/system-overview.md`
- Notes:
  - rename for consistency if desired

### `docs/architecture/git-integration.md`
- Action: `keep`
- Target home: `docs/architecture/repository-model.md` or `docs/architecture/git-integration.md`

### `docs/architecture/extensions.md`
- Action: `move`
- Target home: `docs/extensions/overview.md`
- Notes:
  - topic is extension-facing, not pure architecture

### `docs/architecture/backend-integrity.md`
- Action: `keep`
- Target home: `docs/architecture/backend-integrity.md`
- Notes:
  - maintainer-facing and still structurally useful

### `docs/architecture/event-contracts.md`
- Action: `keep`
- Target home: `docs/architecture/event-contracts.md`

### `docs/architecture/multi-tenancy.md`
- Action: `rewrite`
- Target home: `docs/architecture/tenancy.md`
- Reason:
  - current file still uses older “site/tenant” framing in places
  - needs alignment with the project-centric model

### `docs/architecture/ui-baseline.md`
- Action: `move`
- Target home: `docs/contributor/ui-baseline.md`
- Notes:
  - this is contributor guidance, not system architecture

### `docs/architecture/finished-clean.md`
- Action: `move`
- Target home: `docs/contributor/quality-bar.md`
- Notes:
  - valuable as an internal engineering standard
  - not really architecture

## Gaps Against the Ideal Outline

These important docs do not yet have a clear current equivalent and will need to be created or heavily rewritten.

### Getting Started
- `docs/getting-started/overview.md`
- `docs/getting-started/quickstart.md`
- `docs/getting-started/core-concepts.md`

### Guides
- `docs/guides/model-content.md`
- `docs/guides/edit-and-publish.md`
- `docs/guides/branching-and-promotion.md`
- `docs/guides/manage-members-and-agents.md`
- `docs/guides/configure-environments.md`

### Integrations
- `docs/integrations/astro/README.md`
- `docs/integrations/astro/setup.md`
- `docs/integrations/astro/preview-and-publish.md`
- `docs/integrations/nextjs/README.md`
- `docs/integrations/nextjs/setup.md`
- `docs/integrations/nextjs/preview-and-publish.md`

### Reference
- `docs/reference/api-rest.md`
- `docs/reference/api-graphql.md`
- `docs/reference/authentication.md`
- `docs/reference/agent-api.md`
- `docs/reference/error-codes.md`
- `docs/reference/project-settings.md`
- `docs/reference/cli.md`

### Product
- `docs/product/feature-map.md`
- `docs/product/permissions.md`
- `docs/product/workflow.md`
- `docs/product/support-policy.md`

### Contributor
- `docs/developer/local-development.md`
- `docs/developer/testing.md`
- `docs/contributor/docs-standards.md`

## Recommended Refactor Order

### Phase 1: Establish structure
- rewrite `docs/README.md`
- create destination folders
- move obviously misplaced files without major rewriting

### Phase 2: Stabilize canonical references
- split `docs/API.md`
- choose canonical auth reference
- consolidate agent API/auth docs
- move OpenAPI files into `reference/`

### Phase 3: Fix inaccurate docs
- delete `docs/agents/tiered-access.md`
- rewrite `docs/features/agent-gateway.md`
- rewrite `docs/architecture/multi-tenancy.md`

### Phase 4: Add missing user paths
- create `getting-started/`
- create `guides/`
- create `integrations/astro/`
- create `integrations/nextjs/`

### Phase 5: Prune and tighten
- delete stale docs that no longer carry active product truth
- remove duplicate indexes
- ensure every topic has one canonical home

## Suggested Immediate Moves

If we want a fast first cleanup pass, do these first:

1. Create:
- `docs/reference/`
- `docs/operations/`
- `docs/product/`
- `docs/contributor/`

2. Move:
- `docs/OPERATIONS.md` -> `docs/operations/README.md`
- `docs/deployment.md` -> `docs/operations/deployment.md`
- `docs/GLOSSARY.md` -> `docs/reference/glossary.md`
- `docs/plugin-system-runbook.md` -> `docs/operations/plugin-system-runbook.md`
- `docs/plugin-hook-signing.md` -> `docs/extensions/plugin-hook-signing.md`

3. Delete:
- `docs/DOC_STATUS.md`
- `docs/code-review-fixes.md`
- `docs/agents/tiered-access.md`

4. Rewrite next:
- `docs/README.md`
- `docs/API.md`
- `docs/features/agent-gateway.md`

## Success Condition for the Refactor

After the refactor:

- there should be one obvious place to start
- all current docs should map to the audience and section they serve
- outdated docs should be deleted instead of mixed with current truth
- Astro and Next.js should each have a single integration home
- agent docs should reflect the current role-based model, not historical tiers

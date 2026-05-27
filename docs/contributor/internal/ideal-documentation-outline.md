# Ideal OriCMS Documentation Outline

This document defines the target documentation architecture before refactoring the existing docs.

It is intentionally based on product and engineering needs, not on the current file layout.

## Principles

- One home for each kind of answer.
- User-facing docs and internal engineering docs should be clearly separated.
- Concept docs, task docs, and reference docs should not be mixed together.
- Every major product surface should have:
  - an overview
  - a task guide
  - a reference surface
- Docs should scale for three audiences:
  - evaluators
  - implementers
  - maintainers

## Audience Model

### 1. Evaluators

People deciding whether OriCMS fits their needs.

They need:
- what OriCMS is
- what it is good at
- what is supported today
- how it compares to expected workflows

### 2. Implementers

People setting up, integrating, extending, or using OriCMS.

They need:
- setup steps
- framework integration guides
- API and schema reference
- task-oriented workflows

### 3. Maintainers

People operating or contributing to OriCMS itself.

They need:
- architecture
- operational runbooks
- migration notes
- design decisions

## Ideal Top-Level Structure

```text
docs/
  README.md
  getting-started/
  guides/
  integrations/
  reference/
  operations/
  architecture/
  extensions/
  product/
  contributor/
```

## Section Intent

### `docs/README.md`

Primary docs entrypoint.

It should answer:
- where to start
- who each section is for
- what is stable vs evolving

### `docs/getting-started/`

Fastest path from zero to a working OriCMS instance.

Ideal contents:
- what OriCMS is
- core concepts in one page
- local install
- first project
- first collection
- first publish
- first frontend integration

Suggested files:
- `overview.md`
- `quickstart.md`
- `core-concepts.md`
- `first-project.md`

### `docs/guides/`

Task-oriented workflows.

This is where most day-to-day user documentation should live.

Suggested groupings:
- content modeling
- editorial workflow
- media/assets
- branching and promotion
- environments and publishing
- permissions and members
- agent usage
- search and delivery

Suggested files:
- `model-content.md`
- `manage-collections.md`
- `edit-and-publish.md`
- `branching-and-promotion.md`
- `configure-environments.md`
- `manage-members-and-agents.md`
- `content-delivery.md`

### `docs/integrations/`

Framework and platform integration documentation.

This should be product-quality and adapter-specific.

Suggested groupings:
- `astro/`
- `nextjs/`
- future integrations only when first-class

Each integration should have:
- overview
- install/setup
- local preview
- published deployment flow
- draft vs published behavior
- adapter API/reference
- troubleshooting

Suggested files per integration:
- `README.md`
- `setup.md`
- `preview-and-publish.md`
- `data-model.md`
- `troubleshooting.md`

### `docs/reference/`

Authoritative, low-narrative reference material.

This should be optimized for lookup, not teaching.

Suggested groupings:
- REST API
- GraphQL delivery API
- shared types and payloads
- collection/schema formats
- configuration keys
- environment model
- error codes
- CLI commands

Suggested files:
- `api-rest.md`
- `api-graphql.md`
- `content-model.md`
- `project-settings.md`
- `error-codes.md`
- `cli.md`

### `docs/operations/`

Running OriCMS in real environments.

Suggested topics:
- deployment
- backups and restore
- observability
- incident handling
- webhook delivery troubleshooting
- performance concerns
- security operations

Suggested files:
- `deployment.md`
- `backups.md`
- `observability.md`
- `security.md`
- `runbooks.md`

### `docs/architecture/`

System-level explanation of how OriCMS is built.

This is for maintainers and serious integrators.

Suggested topics:
- monorepo/package map
- data model
- request flow
- collections architecture
- git-backed storage model
- locking/concurrency
- agents architecture
- plugin system
- publishing pipeline

Suggested files:
- `system-overview.md`
- `repository-model.md`
- `collections-and-schemas.md`
- `publishing-pipeline.md`
- `agents.md`
- `plugins.md`
- `locking-and-concurrency.md`

### `docs/extensions/`

Plugin, adapter, and custom integration authoring.

Suggested topics:
- plugin model
- plugin hooks/events
- adapter authoring
- webhook contracts
- SDK/client usage

Suggested files:
- `plugins.md`
- `plugin-hooks.md`
- `adapter-authoring.md`
- `webhook-contracts.md`

### `docs/product/`

High-level product documentation that is not purely technical reference.

Suggested topics:
- feature map
- permissions model
- workflow model
- supported use cases
- support policy

Suggested files:
- `feature-map.md`
- `permissions.md`
- `workflow.md`
- `support-policy.md`

### `docs/contributor/`

Contributing to OriCMS itself.

Suggested topics:
- local dev setup
- test strategy
- codebase map
- release process
- documentation standards

Suggested files:
- `local-development.md`
- `testing.md`
- `releases.md`
- `docs-standards.md`

## Canonical Document Types

Each document should be one of these types:

- Overview
  - explains what something is and why it exists
- Guide
  - teaches how to do something
- Reference
  - authoritative lookup
- Runbook
  - operational response procedures
This distinction should be explicit in titles or frontmatter.

## What Should Not Happen

- API reference mixed into task guides
- architecture notes mixed into setup docs
- outdated roadmap or design docs presented as user guidance
- multiple files explaining the same workflow differently
- framework adapter docs split between package README, root docs, and feature docs without a canonical home

## Canonical Entry Paths

If someone asks:

- "How do I get started?"
  - `getting-started/quickstart.md`
- "How do I do X in OriCMS?"
  - `guides/...`
- "What does this API accept/return?"
  - `reference/...`
- "How does this system work internally?"
  - `architecture/...`
- "How do I operate this in production?"
  - `operations/...`
- "How do I build an extension or adapter?"
  - `extensions/...`

## First Refactor Pass Recommendation

When refactoring the existing docs, the first pass should aim to:

- define one canonical docs homepage
- identify and remove duplicated docs
- move documents into the correct section by intent
- separate current truth from historical design notes
- mark deprecated or archival documents clearly
- create stable homes for Astro and Next.js integration docs

## Success Criteria

The documentation refactor is successful when:

- a new user can get from install to first publish quickly
- an integrator can find the exact API/integration details without reading narrative docs
- a maintainer can explain the architecture from the docs alone
- every major product surface has one obvious documentation home
- outdated documents no longer compete with current truth

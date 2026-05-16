# Feature Map

Use this page when you need a quick mental map of the product before you dive into feature-specific docs.

OriCMS has a few big surfaces and a lot of smaller behaviors around them. The point of this page is to show the shape of the product, not to replace the deeper guides and references.

## Core Platform

OriCMS is a project-centric CMS where the repository is the source of truth for:

- collection configuration
- content types
- entries
- assets

The platform adds:

- structured editing
- Git-backed history
- preview
- builds and delivery hooks
- permissions
- agent governance

## Main Workspace Areas

### Collections

Collections are the main editing surface for structured content.

Current capabilities:

- collection browse
- entry create, update, delete
- history and restore
- branch-aware editing
- stale-revision protection

### Schemas

Schemas define content types and field structure.

Current capabilities:

- content-type create, update, delete
- field configuration
- schema-backed entry editing

### Media

Media manages uploaded assets and their metadata.

Current capabilities:

- upload and browse assets
- metadata editing
- asset selection in structured forms

### Settings

Settings covers project-level configuration.

Current capabilities include:

- general project settings
- branch lifecycle controls
- environment targets
- branch-to-environment mappings
- permission-gated global media management

Git and delivery behavior are configured through the branch and environment
surfaces rather than separate top-level settings panels.

### Builds

Builds is the deployment handoff surface.

Current capabilities:

- inspect build records
- trigger a build manually
- cancel pending or running work
- review downstream export and delivery outcomes

### Members

Members manages both humans and AI agents.

Current capabilities:

- invite human members
- assign project roles
- create AI agents
- revoke or expire agent tokens

## Delivery and Integration Surfaces

### Preview

Preview is branch-aware and intended for checking content before live release.

### Delivery APIs

Current delivery surfaces:

- REST delivery routes
- GraphQL delivery routes

### Frontend Integrations

Current first-class integrations:

- Astro
- Next.js

## Agent Surface

The agent gateway exposes a project-scoped API for AI agents with:

- role-based access
- project-level branch and collection constraints
- PII redaction
- audit logging
- guarded mutations

Current mutation safety features:

- bootstrap
- preflight
- idempotency
- delete confirmation
- stale-revision checks
- explicit workflow transitions

## Collaboration and Safety

Current collaboration model:

- entries use soft coordination plus optimistic concurrency
- structural or destructive operations use stronger lock enforcement
- branches and promotion flows are first-class

If you are new to OriCMS, the simplest way to read the product is:

- model content
- edit entries and assets
- configure preview and publish behavior
- control access
- deliver to a frontend or agent integration

## References

- [permissions-model.md](./permissions-model.md)
- [workflow-model.md](./workflow-model.md)
- [../features/README.md](../features/README.md)

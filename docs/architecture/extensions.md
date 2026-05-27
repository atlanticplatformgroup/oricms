# OriCMS Extension Architecture

This document defines the extension seams that exist today in the Mantine workspace and API. It is intentionally narrow. It describes what is extensible now, what contracts exist, and what is explicitly not stable yet.

## Current Frontend Extension Seams

### 1. Field renderer and capability registry
Location:
- `packages/web/src/components/fields/registry.tsx`
- `packages/web/src/components/fields/contracts.ts`
- `packages/shared/src/field-capabilities.ts`

Purpose:
- Register field renderers by field type.
- Allow builtin renderers and future extension registrations to resolve deterministically.
- Keep browse/list semantics shared across web and API through one capability contract.

Rules:
- Builtin registry is created at module load.
- Extension registration must happen once at bootstrap from `AppWrapper.tsx` or a dedicated workspace init called there.
- Registration must be idempotent under HMR.
- Renderer registrations may optionally provide capability handlers for list display, sort tokens, search tokens, readonly text, and relation hints.
- New browse/search behavior must come from capability resolution rather than new field-type switches.
- Resolution rules:
  - higher `priority` wins
  - for equal priority, last registration wins
  - replace by `type + source`, never accumulate duplicates on reload

Unknown field fallback:
- editor: explicit warning plus generic JSON/text surface
- readonly: structured dump

Not stable yet:
- plugin discovery/loading
- third-party distribution format
- cross-plugin conflict policies beyond priority/source

### 2. Workspace extension registry
Location:
- `packages/web/src/lib/workspace/registry.tsx`

Purpose:
- Register workspace sections, sidebar actions/controls, section header actions, and browse toolbar contributions through one bootstrap path.

Rules:
- Builtin sections register through the same registry future plugins will use.
- Registry registration must be idempotent under HMR.
- Section ordering is registration order unless an extension slot defines `priority`.
- Slot ordering is deterministic: higher `priority` first, then registration order.
- New shell affordances should prefer typed slots over expanding `App.tsx`/shell prop surfaces.

### 3. Readonly field value contract
Location:
- `packages/web/src/components/fields/ReadonlyFieldValue.tsx`

Purpose:
- Canonical display contract for history, previews, and readonly surfaces.

Rules:
- Reuse this component for readonly field display instead of inventing alternate render paths.
- Editor and readonly rendering may differ visually, but should share field-display semantics where possible.

## Current Frontend Composition Seams

### Workspace providers and section models
Locations:
- `packages/web/src/contexts/workspace/WorkspaceRouterContext.tsx`
- `packages/web/src/contexts/workspace/EditorContext.tsx`
- `packages/web/src/contexts/workspace/EntryHistoryContext.tsx`
- `packages/web/src/contexts/workspace/SchemaEditorContext.tsx`
- `packages/web/src/contexts/workspace/CollectionManagerContext.tsx`
- `packages/web/src/hooks/useCollectionBrowseModel.ts`

Purpose:
- Separate shell composition from feature state machines.
- Keep browse state close to the section that owns it.

Rules:
- Providers own state machines.
- `App.tsx` composes providers and shell layout.
- Collection browse search, pagination, sort state, empty-state behavior, and relation label lookup live in `useCollectionBrowseModel`.
- New feature code should prefer provider/hook boundaries over prop drilling.

## Current Backend Extension Seams

### Browse display resolver
Location:
- `packages/api/src/collections/browse-display-resolver.ts`

Purpose:
- Resolve relation display labels for browse/search surfaces with a reusable cache boundary keyed by project/branch revision.

Rules:
- Backend browse/search code should resolve relation labels through this service instead of rebuilding ad hoc maps in route/service handlers.
- Choice labels and other field semantics still come from the shared field capability contract.

### Lifecycle dispatcher
Location:
- `packages/api/src/plugins/dispatcher.ts`

Current event families:
- `entry.beforeCreate`, `entry.afterCreate`
- `entry.beforeUpdate`, `entry.afterUpdate`
- `entry.beforeDelete`, `entry.afterDelete`
- `schema.beforeSave`, `schema.afterSave`
- `schema.beforeDelete`, `schema.afterDelete`
- `collection.beforeCreate`, `collection.afterCreate`
- `collection.beforeDelete`, `collection.afterDelete`

Rules:
- `before*` hooks may block by throwing `LifecycleHookError`.
- `after*` hooks observe committed results.
- Payloads should stay minimal and typed.
- Event ordering must be deterministic.

Currently wired paths:
- REST collections routes
- REST entry routes
- GraphQL entry mutations
- schema save/delete routes
- agent auto-publish entry writes

Not wired intentionally:
- low-level `agent-write` file primitives

Reason:
- low-level file writes do not always imply collection-entry semantics.
- lifecycle events should be emitted from high-level domain operations, not raw file mutation helpers.

## API Client Structure

The old monolithic client has been split into domain modules under `packages/web/src/lib/api/`.

Rules:
- New code should import only the domain client it needs.
- Shared request behavior belongs in `core.ts`.
- `client.ts` is compatibility-only and should not become an implementation center again.

## What Is Intentionally Extensible Now

- field renderers
- field capabilities
- workspace sections/sidebar/header/toolbar contributions
- backend lifecycle events
- workspace provider and section-model boundaries

## What Is Not Stable Yet

- plugin discovery/loading
- third-party distribution format
- capability negotiation between plugins
- versioned plugin contracts
- generalized filter/action API

## Practical Guidance

When adding new code:
- do not put domain transforms back into `App.tsx`
- do not add new field-type switches outside the field registry
- do not add new browse/search semantics outside the shared capability contract
- do not emit lifecycle events from low-level file primitives unless the domain semantics are explicit
- do not add new monolithic API client surfaces

# Event Contracts

OriCMS currently uses two event vocabularies on the backend. They serve different purposes and must stay aligned by explicit mapping.

## Internal lifecycle events

Internal lifecycle events are emitted by application services and are used for blocking or observing domain mutations inside the API process.

Pattern:
- `domain.beforeAction`
- `domain.afterAction`

Examples:
- `entry.beforeCreate`
- `entry.afterUpdate`
- `schema.afterSave`
- `contentType.beforeDelete`
- `asset.afterCreate`

Rules:
- only application services emit lifecycle events
- routes do not emit lifecycle events
- low-level git/file primitives do not emit high-level lifecycle events
- `before*` hooks may block by throwing a `LifecycleHookError`
- `after*` hooks observe committed mutations

## Public plugin and webhook events

Public-facing plugin/webhook events are stable semantic names used by the plugin hook dispatcher and webhook-facing integrations.

Current event names:
- `page.workflow.transition`
- `collection.record.created`
- `collection.record.updated`
- `collection.record.deleted`
- `collection.created`
- `collection.deleted`
- `schema.saved`
- `schema.deleted`
- `content-type.created`
- `content-type.updated`
- `content-type.deleted`
- `asset.created`
- `asset.updated`
- `asset.deleted`

Rules:
- public event names come from `packages/shared/src/plugin-events.ts`
- callers should use `PLUGIN_EVENT_NAMES.*` instead of hardcoded strings
- lifecycle-to-plugin mapping is centralized in the application mutation layer that dispatches plugin hooks

## Alignment rule

Internal lifecycle events and public plugin/webhook events do not need to have the same names, but they must have an explicit mapping.

Current policy:
- lifecycle events are implementation-oriented and typed by mutation stage
- plugin/webhook events are domain-oriented and stable for external consumers
- canonical event-name definitions live in one place only: `packages/shared/src/plugin-events.ts`

## Intentionally low-level paths

`agent-write` remains intentionally low-level.

It does not emit high-level entry/content-type/asset lifecycle events unless it is wrapped by an application service that can prove the domain semantics of the write.

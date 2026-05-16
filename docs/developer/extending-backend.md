# Extending Backend

Use this page when adding backend extension behavior, plugin hooks, or new high-level lifecycle events.

## Core Areas

- `packages/api/src/application`
- `packages/api/src/plugins/dispatcher.ts`
- `packages/api/src/plugins/hook-dispatcher.ts`
- `packages/api/src/plugins/service.ts`
- `packages/api/src/plugins/routes.ts`

## Prefer High-Level Domain Operations

If a feature represents a real domain mutation, implement it in the application layer first.

Examples:

- entries
- collections
- content types
- schemas
- assets

This matters because lifecycle events and plugin webhooks should be emitted from the same high-level operation regardless of which route family triggered it.

Do not emit plugin semantics from low-level file primitives unless the domain meaning is explicit.

## Lifecycle Hooks

The in-process lifecycle dispatcher lives in:

- `packages/api/src/plugins/dispatcher.ts`

Current hook families include:

- entry create, update, delete
- collection create, delete
- schema save, delete
- content type create, update, delete
- asset create, update, delete

Use lifecycle hooks when:

- a repository-local extension needs to observe or block a domain event
- the event should run synchronously in-process

Use `LifecycleHookError` to block a `before*` event intentionally.

## Plugin Webhook Dispatch

Webhook-style plugin dispatch lives in:

- `packages/api/src/plugins/hook-dispatcher.ts`

Use webhook dispatch when:

- the event should go to an enabled project plugin
- delivery should respect plugin execution policy, endpoint configuration, secrets, and retries

The hook dispatcher already handles:

- enabled plugins
- per-project hook endpoints
- secret lookup
- retry policy
- allowlisted hooks
- blocked plugins

## Plugin Registry and Manifests

Plugin manifest discovery lives in:

- `packages/api/src/plugins/service.ts`

The registry currently reads manifests from repository files under `plugins/`.

Treat the manifest surface as current but intentionally narrow:

- plugin identity and version
- declared capabilities
- declared hooks
- optional UI contribution declarations

It is not yet a general marketplace or package installation system.

## Route Families

Plugin-facing route families are mounted from:

- `packages/api/src/plugins/routes.ts`

Current sub-surfaces include:

- catalog
- configuration
- event/audit views

If you add a plugin-facing management capability, prefer extending this route family instead of creating unrelated top-level routes.

## Extension Hygiene Rules

- Define event names in shared contracts first.
- Emit lifecycle and webhook events from high-level operations.
- Keep plugin audit and policy behavior project-scoped.
- Reuse canonical API responses and validation helpers.
- Avoid adding plugin special cases directly inside unrelated route handlers.

## Testing

Relevant test areas include:

- `packages/api/src/plugins/__tests__`
- application-layer mutation tests under `packages/api/src/application/**/__tests__`

Add tests for:

- successful dispatch
- blocked `before*` hooks
- policy enforcement
- retry or endpoint validation behavior
- manifest validation when changing registry rules

## Related Docs

- [../extensions/plugin-authoring.md](../extensions/plugin-authoring.md)
- [../extensions/webhook-contracts.md](../extensions/webhook-contracts.md)
- [shared-contracts.md](./shared-contracts.md)
- [building-adapters.md](./building-adapters.md)

# Plugin System Runbook

> **Feature:** Plugin runtime operations
> **Status:** Current

## Overview

This runbook covers operational ownership for the OriCMS plugin runtime:

- manifest discovery and enablement
- hook endpoint configuration
- secret rotation
- execution and UI policy controls
- health, reconciliation, and event review
- policy rollback procedures

Plugin runtime is project-scoped and is mounted under project routes.

## Prerequisites

- project role: `owner` or `admin` for rollback operations
- permission level equivalent to `settings:update` for runtime configuration
- access to the project settings area in the web app or a valid management API token

## Current Runtime Surface

Base prefix:

```text
/api/v1/projects/:projectId/plugins
```

### Catalog and discovery

- `GET /`
- `GET /id/:pluginId`
- `GET /ui-contributions`

### Enablement and configuration

- `PATCH /enabled`
- `GET /hooks`
- `PATCH /hooks`
- `GET /secrets`
- `POST /secrets/:pluginId/rotate`
- `DELETE /secrets/:pluginId`
- `GET /execution-policy`
- `PATCH /execution-policy`
- `GET /ui-policy`
- `PATCH /ui-policy`
- `POST /ui-policy/preview`

### Health and events

- `POST /reconcile`
- `POST /test-fire`
- `GET /health`
- `GET /events`
- `GET /events/summary`
- `GET /policy-events`
- `POST /policy-events/:eventId/rollback/preview`
- `POST /policy-events/:eventId/rollback`

## Security Baseline

1. Keep execution policy in `webhook-only` unless maintenance requires disabling hooks.
2. Keep `enforceManifestCapabilities = true` in production.
3. Rotate plugin secrets on schedule and after any suspected leak.
4. Use signed hook verification on receivers. See [plugin-hook-signing.md](../extensions/plugin-hook-signing.md).
5. Treat `test-fire` as privileged and review the resulting audit trail.

## Daily Checks

1. Review plugin event summary for failure spikes.
2. Review policy events for unexpected execution-policy or UI-policy changes.
3. Review plugin health for:
   - invalid manifests
   - stale enabled plugin ids
   - blocked enabled plugins
   - missing hook endpoints
   - stale hook endpoints
4. Run reconcile in dry-run mode before applying cleanup.

## Incident Response

### Hook Delivery Failures

1. Review `GET /events?status=failed`.
2. Validate receiver reachability and TLS.
3. Confirm the target plugin still declares the hook being dispatched.
4. Rotate the plugin secret if signature verification is failing repeatedly.
5. Use `POST /test-fire` to confirm recovery.

### Manifest or Config Drift

1. Review `GET /health`.
2. Fix invalid manifests in the project repo first.
3. If the issue is only stale enabled ids or stale hook endpoints, use `POST /reconcile`.
4. Re-check health and event summary afterward.

### Unsafe Policy Change

1. Review `GET /policy-events`.
2. Use `POST /policy-events/:eventId/rollback/preview`.
3. Confirm the rollback payload is correct.
4. Apply `POST /policy-events/:eventId/rollback`.
5. Confirm the corresponding rollback audit event appears.

## Rollback Playbook

Use this sequence for policy rollback:

1. `POST /policy-events/:eventId/rollback/preview`
2. Confirm `rollbackable = true`
3. Inspect the current and rollback policy snapshots
4. `POST /policy-events/:eventId/rollback`
5. Verify the new policy state and the rollback audit event

Current constraints:

- only execution-policy and UI-policy update events are rollbackable
- duplicate rollback attempts return `409 POLICY_EVENT_ALREADY_ROLLED_BACK`
- rollback writes an audit event referencing the original event id

## Reconcile Guidance

Use reconcile when manifests and stored runtime settings have drifted apart.

Recommended sequence:

1. `POST /reconcile` with `{ "dryRun": true }`
2. inspect `removedEnabledPlugins` and `removedHookEndpoints`
3. rerun with `{ "dryRun": false }` only when the proposed cleanup is acceptable

## CI and Verification

Plugin runtime verification should include:

- API plugin route tests under `packages/api/src/plugins/__tests__`
- client/plugin helper coverage where applicable
- end-to-end UI/runtime checks if plugin UI surfaces are changed

Treat runtime route failures as release blockers for plugin changes.

## References

- [plugin-hook-signing.md](../extensions/plugin-hook-signing.md)
- [routes.ts](../../packages/api/src/plugins/routes.ts)
- [catalog-routes.ts](../../packages/api/src/plugins/catalog-routes.ts)
- [config-routes.ts](../../packages/api/src/plugins/config-routes.ts)
- [events-routes.ts](../../packages/api/src/plugins/events-routes.ts)

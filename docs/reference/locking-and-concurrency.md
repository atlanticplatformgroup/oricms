# Locking and Concurrency

Use this page when you need the coordination model behind concurrent editing in OriCMS.

The current shared lock types live in `packages/shared/src/types.ts`, and the API implementation lives in `packages/api/src/locks`.

## Two Coordination Modes

OriCMS uses two different coordination modes on purpose:

- hard locks for structural, destructive, or high-impact operations
- soft coordination plus optimistic concurrency for normal entry editing

## Hard Locks

Hard locks are used for resources like:

- schemas
- content types
- collection configuration
- branch promotion
- critical project settings
- destructive member/agent/config flows
- destructive bulk operations

Hard locks require a lock token and can return `RESOURCE_LOCKED`.

Current hard-lock resource types are:

- `schema`
- `contentType`
- `collectionConfig`
- `branchPromotion`
- `projectSettings`
- `members`
- `agentConfig`
- `bulkMutation`

## Soft Coordination

Normal entry editing uses:

- presence
- optimistic concurrency
- stale revision checks

Current soft-coordination resource types are:

- `entry`
- `assetMetadata`

This avoids over-locking routine editorial work while still preventing silent overwrites.

## Current Lock API

Project-scoped lock routes:

- `POST /api/v1/projects/:projectId/locks/acquire`
- `POST /api/v1/projects/:projectId/locks/renew`
- `POST /api/v1/projects/:projectId/locks/release`
- `GET /api/v1/projects/:projectId/locks/status`

`acquire` returns a lock token for hard locks. `renew` and `release` require that token so another session cannot silently take over the lease.

Current request headers:

- `x-ori-session-id`: caller session identity for acquire, renew, and release
- `x-ori-lock-token`: issued hard-lock token for renew and release

## Agent Behavior

Agent preflight can surface lock information. Mutations that hit hard-locked resources should handle:

- `RESOURCE_LOCKED`
- `STALE_REVISION`

The product goal here is not to serialize every action. It is to protect the operations where silent conflict would actually hurt.

## Related Docs

- [../product/workflow-model.md](../product/workflow-model.md)
- [history-and-restore.md](./history-and-restore.md)

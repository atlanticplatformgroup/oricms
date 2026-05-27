# Client SDK

Use this page to understand the current TypeScript client package.

## Current Status

`@oricms/client` is a convenience layer over the OriCMS API.

Most importantly:

- the SDK now uses `projectId`
- `siteId` is still accepted as a deprecated compatibility shim for older callers

Treat it as a convenience package, not as a stronger contract than the API itself.

## What It Provides

The current package includes helpers for:

- collections access and mutation helpers
- schema access
- resource collection and record helpers
- workspace catalog and UI group helpers
- GraphQL management and delivery helpers
- plugin runtime helpers
- plugin hook verification
- revalidation webhook verification

## Current Grouped Surface

### `client.collections`

- `list(type, query?)`
- `get(type, id, query?)`
- `create(type, data)`
- `update(type, id, data)`
- `delete(type, id)`

Use this group for management-mode collection CRUD or delivery-mode collection reads.

### `client.schemas`

- `list()`
- `generateTypeStubs()`

Use this group when you need the current content-type registry or generated TypeScript stubs from it.

### `client.resources`

- `list()`
- `get(resourceCollectionId)`
- `listRecords(resourceCollectionId, options?)`
- `getRecord(resourceCollectionId, recordId)`
- `getSchema(resourceCollectionId)`

Use this group for management-mode resource collection and resource record access.

### `client.workspace`

- `listSystemSurfaces()`
- `listUiGroups()`
- `getUiGroup(uiGroupId)`
- `createUiGroup(input)`
- `updateUiGroup(uiGroupId, input)`
- `deleteUiGroup(uiGroupId)`
- `getCatalog()`

Use this group for management-mode workspace catalog and UI-group management.

### `client.graphql`

- `execute(query, options?)`
- `getSchemaSdl()`
- `getSchemaIntrospection()`
- `executePersisted(persistedQueryId, options?)`
- `listPersistedQueries()`
- `upsertPersistedQueries(payload)`
- `listSchemaSnapshots()`
- `captureSchemaSnapshot()`
- `getSchemaSnapshot(version)`

Management mode exposes schema-registry and persisted-query administration. Delivery mode exposes read-side GraphQL and persisted-query execution.

### `client.plugins`

Current plugin helpers cover:

- catalog reads: `list()`, `get(pluginId)`
- enabled-state mutation: `setEnabled(enabled)`
- hook config: `getHooksConfig()`, `setHooksConfig(payload)`
- secret lifecycle: `listSecrets()`, `rotateSecret(pluginId)`, `revokeSecret(pluginId)`
- execution policy: `getExecutionPolicy()`, `setExecutionPolicy(payload)`
- runtime checks: `fireTestEvent(payload)`, `getHealth()`, `reconcile(payload?)`
- UI contributions and policy: `getUiContributions()`, `getUiPolicy()`, `setUiPolicy(payload)`, `previewUiPolicy(payload)`
- policy history and rollback: `listPolicyEvents(params?)`, `previewPolicyRollback(eventId)`, `rollbackPolicyEvent(eventId)`
- hook event history: `listEvents(params?)`, `getEventSummary()`

### Standalone verification helpers

- `verifyPluginHookRequest(input)`
- `verifyRevalidationWebhookRequest(input)`

Use these when you are implementing the receiver side of signed plugin hooks or signed revalidation callbacks.

## Source of Truth

The current implementation lives in:

- `packages/client/src/index.ts`

## Related Docs

- [api-overview.md](./api-overview.md)
- [webhooks.md](./webhooks.md)

# Agent API Reference

This page is the practical reference for the current agent gateway.

It is meant to answer two questions quickly:

- what can an agent call?
- what mutation contract should an agent actually follow?

## Base URL

```text
https://your-oricms.com/api/v1/agent/v1
```

## Authentication

All requests require:

```http
Authorization: Bearer YOUR_AGENT_TOKEN
```

## Current Endpoint Surface

### Session and status

- `GET /bootstrap`
- `GET /status`

### Read APIs

- `GET /schemas`
- `GET /schemas/:id`
- `GET /structure`
- `GET /history`
- `GET /collections/:name/entries`
- `GET /collections/:name/entries/:id`
- `GET /files/*`
- `POST /diagnose`

### Mutation APIs

- `POST /preflight`
- `POST /schemas`
- `PUT /schemas/:name`
- `POST /collections/:name/entries`
- `PUT /collections/:name/entries/:id`
- `POST /collections/:name/entries/:id/transition`
- `DELETE /collections/:name/entries/:id`

Separate JWT-authenticated admin routes also exist under `/api/v1/agent/v1/admin/*` for project members who manage agent policy, consent, tokens, and audit history. Those are part of the management API, not the bearer-token agent runtime contract.

If you are building a writing agent, the important path is not “memorize every endpoint.” It is:

1. authenticate
2. call bootstrap
3. inspect the current context
4. preflight before mutation
5. trust canonical mutation responses

## Bootstrap

`GET /bootstrap`

Returns a compact live brief for the current project context.

Response includes:

- `project`
- `capabilities`
- `contentModel`
- `entryIdentity`
- `workflow`
- `writePolicies`
- `summaryMarkdown`
- `generatedAt`
- `configVersion`
- `configUpdatedAt`

Key operational rules from bootstrap:

- new entries default to `draft`
- `published` is the persisted value behind the UI label `Ready`
- delete requires confirmation
- use returned `entryId` / `$id` as the canonical identifier
- do not assume `slug` is the entry id

## Status

`GET /status`

Returns current agent access configuration:

- `enabled`
- `role`
- `allowedCollections`
- `allowedBranches`
- `historyDays`
- `historyDepth`
- `deploymentMode`

## Schemas

### `GET /schemas`

Returns all readable content types.

### `GET /schemas/:id`

Returns one readable content type by id.

If the schema does not exist, the API returns:

- `404 CONTENT_TYPE_NOT_FOUND`

## Repository Structure

`GET /structure`

Returns a summary of readable repository structure for the selected branch.

Current response shape:

- `schemas`: list of schema names
- `collections`: list of collection summaries with `name`, `allowed`, and optional `count`

Optional query:

- `branch`

## History

`GET /history`

Returns filtered git history for the selected branch.

Optional query:

- `branch`

History is bounded by the project’s current `historyDays` and `historyDepth` settings.

## Collection Entries

### `GET /collections/:name/entries`

Lists entries for a readable collection.

Supported query params:

- `branch`
- `page`
- `pageSize`

If the collection does not exist:

- `404 COLLECTION_NOT_FOUND`

### `GET /collections/:name/entries/:id`

Returns one entry from a readable collection.

If the entry does not exist:

- `404 ENTRY_NOT_FOUND`

## Raw Files

`GET /files/*`

Returns raw file content for allowed paths.

Notes:

- branch-aware
- PII redaction is applied before content is returned
- admin-level capability is required for raw file access

## Diagnose

`POST /diagnose`

Runs a diagnostic pass and records the request in audit logs.

Supported body fields:

- `scope`: `schema`, `content`, or `full`
- `branch`

## Mutation Preflight

`POST /preflight`

Validates a planned mutation without mutating content.

Request shape:

```json
{
  "action": "delete",
  "collectionName": "blog-posts",
  "entryId": "post-123",
  "branch": "main",
  "baseRevision": "rev_abc"
}
```

Schema-definition preflight uses the schema-centric structural actions:

```json
{
  "action": "createSchema",
  "schemaName": "landing-pages",
  "branch": "main",
  "data": {
    "schema": {
      "id": "landing-pages",
      "label": "Landing Pages",
      "contentType": "landing-page",
      "path": "content/landing-pages"
    }
  }
}
```

Response fields:

- `allowed`
- `action`
- `collectionName`
- `schemaName` for schema-definition mutations
- `entryId`
- `branch`
- `resultingStatus`
- `autoPublish`
- `requiresConfirmation`
- `confirmationToken`
- `details`
- `currentRevision`
- `lock`
- `generatedAt`
- `configVersion`

If `allowed` is `false`, inspect `details` instead of guessing why the mutation would fail.

Schema-definition preflight responses include `structural: true` and require `schemas:update` permission. Supported structural actions are `createSchema` and `updateSchema`.

## Canonical Mutation Response

Successful create, update, transition, and delete operations use a common result shape:

```json
{
  "success": true,
  "data": {
    "action": "create",
    "collectionName": "blog-posts",
    "entryId": "post-123",
    "branch": "main",
    "resultingStatus": "draft",
    "changeRequest": {
      "id": "cr_123",
      "status": "AUTO_PUBLISHED",
      "message": "Entry created and auto-published"
    },
    "persistence": {
      "persisted": true,
      "commitSha": "abc123",
      "revision": "rev_123"
    },
    "entry": {
      "$id": "post-123",
      "$status": "draft"
    },
    "generatedAt": "2026-03-13T12:00:00.000Z",
    "configVersion": "2d6f4f..."
  }
}
```

Response nuances:

- `entry` is present when a persisted entry exists
- `proposedEntry` is used when a change is queued for review instead of already persisted
- `deletedEntry` is used for delete results

That common response is there to keep agent integrations predictable. An agent should not need a different parsing strategy for every mutation.


## Create Schema Definition

`POST /schemas`

Headers:

- `Idempotency-Key` recommended

Body:

```json
{
  "schema": {
    "id": "landing-pages",
    "label": "Landing Pages",
    "contentType": "landing-page",
    "path": "content/landing-pages"
  },
  "branch": "main"
}
```

Successful responses use the schema-definition structural shape:

```json
{
  "success": true,
  "data": {
    "action": "createSchema",
    "schemaName": "landing-pages",
    "branch": "main",
    "structural": true,
    "schema": {
      "id": "landing-pages",
      "label": "Landing Pages",
      "contentType": "landing-page",
      "path": "content/landing-pages"
    },
    "createdSchemas": ["landing-pages"],
    "persistence": {
      "persisted": true,
      "commitSha": "abc123"
    },
    "generatedAt": "2026-03-13T12:00:00.000Z",
    "configVersion": "abc123"
  }
}
```

## Update Schema Definition

`PUT /schemas/:name`

Headers:

- `Idempotency-Key` recommended

Body:

```json
{
  "schema": {
    "id": "blog-posts",
    "label": "Editorial Posts",
    "contentType": "blog-post",
    "path": "content/blog-posts"
  },
  "branch": "main"
}
```

The route `:name` must match `schema.id`. Schema-definition mutations are governed structural writes: they respect allowed branch policy, require `schemas:update`, and emit audit actions `agent.schema.create` / `agent.schema.update` with `resourceType: schemaDefinition`.

## Create Entry

`POST /collections/:name/entries`

Headers:

- `Idempotency-Key` recommended

Body:

- entry field data
- optional `branch`
- optional `baseRevision` when the client is coordinating against a known revision

## Update Entry

`PUT /collections/:name/entries/:id`

Headers:

- `Idempotency-Key` recommended

Body:

- entry field data
- optional `branch`
- optional `baseRevision`

If `baseRevision` is stale, the API returns:

- `409 STALE_REVISION`

## Transition Entry Status

`POST /collections/:name/entries/:id/transition`

Headers:

- `Idempotency-Key` recommended

Body:

```json
{
  "targetStatus": "published",
  "branch": "main",
  "baseRevision": "rev_abc"
}
```

Supported transitions:

- `draft -> published`
- `published -> draft`

Persisted status values remain:

- `draft`
- `published`

The UI label `Ready` maps to persisted status `published`.

## Delete Entry

`DELETE /collections/:name/entries/:id`

Headers:

- `X-Agent-Confirmation` required after preflight indicates confirmation is required
- `Idempotency-Key` recommended

## Operational Rules Worth Remembering

- call bootstrap first
- use preflight before destructive or workflow-changing writes
- send `Idempotency-Key` on mutations
- use returned identifiers and revisions as the source of truth
- handle `RESOURCE_LOCKED` and `STALE_REVISION` as normal control flow

Deletes should follow this sequence:

1. call `POST /preflight`
2. get `confirmationToken`
3. call delete with `X-Agent-Confirmation`

## Error Format

All non-success responses use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

## Common Error Codes

| Code | HTTP | Meaning |
|------|------|------|
| `INVALID_AGENT_TOKEN` | 401 | Token does not exist |
| `REVOKED_AGENT_TOKEN` | 401 | Token was revoked |
| `EXPIRED_AGENT_TOKEN` | 401 | Token expired |
| `AGENT_ACCESS_DENIED` | 403 | Role or project config denied the request |
| `COLLECTION_NOT_FOUND` | 404 | Collection does not exist |
| `CONTENT_TYPE_NOT_FOUND` | 404 | Content type does not exist |
| `ENTRY_NOT_FOUND` | 404 | Entry does not exist |
| `BRANCH_NOT_ALLOWED` | 403 | Requested branch is not allowed |
| `IDEMPOTENCY_CONFLICT` | 409 | Same idempotency key reused with a different payload |
| `CONFIRMATION_REQUIRED` | 400 | Delete confirmation token missing or invalid |
| `STALE_REVISION` | 409 | Entry changed since the caller’s base revision |
| `RESOURCE_LOCKED` | 409 | A hard lock prevents the requested operation |

## Important Current Behavior

- permissions are role-based, not tier-based
- collection reads and writes are still constrained by project agent config and collection write policy
- raw file access is more restricted than normal collection reads
- agents should trust returned `entryId` instead of assuming `slug` or title-derived ids

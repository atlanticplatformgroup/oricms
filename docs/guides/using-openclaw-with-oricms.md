# Using OpenClaw with OriCMS

Use this guide when you want an OpenClaw agent to read or write content through the OriCMS agent gateway.

This is not a separate OpenClaw-specific API surface. OpenClaw integrates with OriCMS the same way any other writing agent does:

- bearer token authentication
- project-scoped access
- agent gateway reads and mutations
- preflight and confirmation for guarded writes

## What This Guide Assumes

This guide assumes:

- OriCMS is already running
- you have access to the project’s **Members** workspace
- OpenClaw can make HTTP requests and store a bearer token securely

If you need the exact route reference, use:

- [../agents/api-reference.md](../agents/api-reference.md)
- [../agents/authentication.md](../agents/authentication.md)

## The Right Mental Model

Treat OpenClaw as an OriCMS project member with an agent token.

That means:

- OpenClaw does not bypass the normal permission model
- OpenClaw should not call the human management API as if it were a browser session
- OpenClaw should use the project-scoped agent gateway
- OpenClaw should treat bootstrap and preflight responses as the source of truth

## Step 1: Create The Agent

In the OriCMS project:

1. open **Members**
2. choose **Add AI Agent**
3. give the agent a clear name such as `OpenClaw Writer`
4. choose the lowest role that still fits the job
5. create the token and store it securely

Recommended starting role:

- `viewer` if OpenClaw only needs to inspect content
- `editor` if OpenClaw should draft or update content
- `admin` only if it genuinely needs admin-level agent operations

Generated agent tokens use the `agt_` prefix.

## Step 2: Configure OpenClaw

OpenClaw needs:

- base URL: `https://your-oricms.example.com/api/v1/agent/v1`
- bearer token: the generated OriCMS agent token

Example auth header:

```http
Authorization: Bearer YOUR_AGENT_TOKEN
```

## Handle The Token Safely

Treat the OriCMS agent token like a production secret.

Good defaults:

- store it in an environment variable or secret manager
- never commit it to source control
- do not paste it into prompts, logs, or screenshots
- use a separate token per environment or deployment target
- rotate it if the host, operator, or ownership context changes
- prefer the lowest role that still allows the intended OpenClaw workflow

If you suspect the token leaked, revoke it and create a new one instead of trying to keep using it.

## Step 3: Make Bootstrap The First Call

Do not start by guessing routes or collection rules.

Start with:

```http
GET /api/v1/agent/v1/bootstrap
Authorization: Bearer YOUR_AGENT_TOKEN
```

Bootstrap tells OpenClaw:

- project context
- readable and writable collections
- allowed branches
- workflow rules
- write policies
- current content model summary

If OpenClaw is going to plan or draft content, bootstrap should be its first source of truth.

## Step 4: Decide The Agent’s Job

OpenClaw can be used in at least three sane ways.

### Read-only research agent

Use:

- `GET /status`
- `GET /schemas`
- `GET /structure`
- `GET /collections/:name/entries`
- `GET /collections/:name/entries/:id`

Best role:

- `viewer`

### Draft-writing assistant

Use:

- bootstrap
- entry reads
- preflight
- create/update mutations

Best role:

- `editor`

### Controlled publishing assistant

Use only if a real human workflow supports it.

OpenClaw should:

- inspect write policies first
- use preflight before every mutation
- use transition endpoints explicitly for state changes
- respect confirmation-token requirements for destructive work

## Step 5: Follow The Safe Mutation Loop

If OpenClaw writes content, use this sequence:

1. call `GET /bootstrap`
2. inspect allowed collections and branches
3. read the current entry if this is an update
4. call `POST /preflight`
5. submit the mutation with an `Idempotency-Key`
6. trust the returned `entryId`, revision, and status
7. use transition routes for status changes

Do not build an OpenClaw workflow that skips preflight and then tries to infer what happened from local assumptions.

For the full mutation guidance, see:

- [agent-mutation-workflow.md](./agent-mutation-workflow.md)

## Recommended First Test

The first useful test is:

1. call bootstrap
2. list one readable collection
3. fetch one known entry
4. run preflight for a no-op or safe update

That confirms:

- token validity
- project membership
- collection access
- write policy visibility

## A Minimal Example Flow

### Check status

```bash
curl -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  https://your-oricms.example.com/api/v1/agent/v1/status
```

### Bootstrap context

```bash
curl -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  https://your-oricms.example.com/api/v1/agent/v1/bootstrap
```

### List entries

```bash
curl -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  "https://your-oricms.example.com/api/v1/agent/v1/collections/posts/entries?page=1&pageSize=20"
```

### Preflight a write

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "collectionName": "posts",
    "entryId": "hello-world",
    "branch": "main",
    "baseRevision": "rev_abc123"
  }' \
  https://your-oricms.example.com/api/v1/agent/v1/preflight
```

## Good Defaults

If you are not sure how aggressive OpenClaw should be, use these defaults:

- role: `editor`
- branch scope: non-production branch first
- write mode: human review where available
- publish behavior: explicit transition only, never implicit assumptions
- deletes: disabled unless a human flow truly requires them

## Common Mistakes

### Treating OpenClaw like a browser automation client

Do not drive OriCMS by emulating the admin UI when the agent gateway already exists.

### Using admin power too early

Do not start OpenClaw as `admin` unless the workflow actually needs it.

### Skipping bootstrap

OpenClaw should not hard-code assumptions about collections, workflow labels, or branch access.

### Skipping preflight

Preflight is not optional ceremony. It is how OpenClaw learns whether the planned mutation is currently allowed.

## Troubleshooting

### `401`

Check:

- token value
- token expiry
- token revocation state

### `403`

Check:

- agent role
- allowed collections
- allowed branches
- project-level agent configuration

### `RESOURCE_LOCKED` or `STALE_REVISION`

Treat these as normal coordination signals, not exceptional failures. OpenClaw should re-read current state and try again with the latest revision.

### “OpenClaw can read but not publish”

That usually means:

- the role is too narrow, or
- the project write policy requires a different mutation path, confirmation token, or explicit transition

## Related Docs

- [../agents/README.md](../agents/README.md)
- [../agents/authentication.md](../agents/authentication.md)
- [../agents/api-reference.md](../agents/api-reference.md)
- [./agent-mutation-workflow.md](./agent-mutation-workflow.md)
- [../reference/api/agent-gateway.md](../reference/api/agent-gateway.md)

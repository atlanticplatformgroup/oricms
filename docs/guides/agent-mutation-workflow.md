# Agent Mutation Workflow

Use this guide when you are building an agent that needs to write content without guessing its way through the API.

The safest agent integrations are boring on purpose. They do a small amount of setup, ask permission before mutating, and treat the server response as the source of truth.

## Recommended Flow

1. call bootstrap first
2. inspect allowed branches, collections, and write policies
3. call preflight before mutating
4. send an `Idempotency-Key` on mutations
5. use returned `entryId` and revision metadata as the source of truth
6. handle `RESOURCE_LOCKED` and `STALE_REVISION`
7. use the explicit transition endpoint for status changes
8. send confirmation tokens for destructive actions when required

That flow is more disciplined than a generic CRUD loop, but it exists to keep agents predictable under retry, concurrent editing, and workflow rules.

## Important Rules

- `$id` is the canonical entry identifier
- do not assume `slug` is the entry id
- new entries default to `draft`
- `Ready` in the UI maps to stored `published`
- deletes require stronger confirmation than ordinary create/update flows

The most common mistake to avoid is assuming that submitted content fields determine identity. They do not. After create, the agent should trust the returned `entryId` and revision metadata rather than inferring anything from `slug`, `title`, or local state.

## What A Well-Behaved Agent Looks Like

A good OriCMS-writing agent does three things consistently:

- it asks the server what is allowed before acting
- it reuses server-assigned identifiers and revisions instead of inventing its own model
- it treats lock, stale-revision, and confirmation responses as normal control flow, not exceptional edge cases

That is the difference between an agent that works in a demo and one that behaves well inside a real team workflow.

## Related Docs

- [../agents/api-reference.md](../agents/api-reference.md)
- [../reference/locking-and-concurrency.md](../reference/locking-and-concurrency.md)

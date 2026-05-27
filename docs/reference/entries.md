# Entries

Use this page when you need the actual entry contract rather than the editing workflow around it.

The shared type lives in `packages/shared/src/types.ts` as `CollectionEntry`.

## Canonical Identity

The canonical entry identifier is `$id`.

Important rule:

- do not assume `slug` is the entry id
- after create, use the returned entry id from the API response

That is the most important practical rule on this page.

## Current Stored Fields

The current entry envelope includes:

- `$id`
- `$type`
- `$status`
- `$createdAt`
- `$updatedAt`
- optional `$publishedAt`

After that envelope, the entry contains its schema-defined content fields.

## Status

Stored values are currently:

- `draft`
- `published`

In the UI, `published` is labeled `Ready`.

## Revisions

Entry read responses can include revision metadata. Mutations that need optimistic concurrency should use the current revision as the base for update, delete, or transition operations.

## Entry Envelope vs Mutation Results

The stored entry contract above is not the same thing as every API response that may wrap an entry.

In particular, guarded agent mutations can return:

- persisted `entry` results
- `proposedEntry` when review-mode policy prevents immediate persistence
- `deletedEntry` summaries for delete operations

Those are mutation-result shapes, not additional fields stored inside the entry itself.

## Related Docs

- [history-and-restore.md](./history-and-restore.md)
- [locking-and-concurrency.md](./locking-and-concurrency.md)
- [../guides/editing-and-publishing.md](../guides/editing-and-publishing.md)

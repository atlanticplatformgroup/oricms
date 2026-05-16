# Collections

Use this page when you need the collection configuration model.

The shared type lives in `packages/shared/src/types.ts` as `CollectionConfig`.

## What a Collection Does

A collection binds a storage path and editing surface to a content type.

This means OriCMS can:

- reuse one content type across multiple collections
- keep collection-specific labels and routing behavior
- store entries in collection-specific directories

If content types define shape, collections define where that shaped content lives and how editors encounter it.

## Collection Shape

A collection defines:

- `id`
- `label`
- `singularLabel`
- `contentType`
- `path`
- `icon`
- `description`
- `pinnedEntryIds`
- optional `routing`

## Routing

Routing metadata can include:

- `enabled`
- `slugPattern`
- `homepageId`

This is collection-level editorial metadata. It does not replace frontend routing in Astro, Next.js, or other consumers.

## Storage Path

`path` controls where entry JSON files live under the repository `content/` tree.

That path is part of the collections-native repo format, so it matters to loaders, adapters, and export paths as well as to the editor.

## Important Notes

- Collections are branch-aware because the repo is branch-aware.
- Collection config is distinct from write policy. Agent write policy is a separate operational surface.
- Collection browse behavior depends on content type display fields and shared field capabilities.

## Related Docs

- [content-types.md](./content-types.md)
- [entries.md](./entries.md)
- [../guides/content-modeling.md](../guides/content-modeling.md)

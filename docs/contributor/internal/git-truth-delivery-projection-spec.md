# Delivery Projection Planning Note

This file is a planning note, not the canonical description of current OriCMS behavior.

If this note and the public docs disagree, trust the public docs and the code:

- [docs/reference/content-delivery.md](../../reference/content-delivery.md)
- [docs/reference/api-overview.md](../../reference/api-overview.md)

## Purpose

Record the intended direction for OriCMS delivery architecture without pretending that every internal note is a source of truth.

## Current Reality

Today:

- Git-backed repository files are canonical for content, collection config, and schemas
- preview is repo-aware and branch-aware
- published delivery reads from a revision-tracked PostgreSQL projection derived from the repository
- PostgreSQL is canonical for operational state such as auth, memberships, locks, builds, CDN state, delivery keys, and agent state

## Intended Direction

OriCMS should keep Git JSON as the authoring source of truth while moving published delivery reads onto a projected store.

Target split:

- Git remains canonical for authoring, branching, history, and promotion
- preview remains repo-aware
- published REST and GraphQL read from a derived delivery projection
- the projection stays derivative only and never becomes a second authoring surface

## Why

This direction preserves the parts of the current model that are strong:

- Git-native workflow
- branch-aware authoring
- explicit repository history

While fixing the parts that are weak for enterprise delivery:

- repo-backed hot-path reads
- expensive filtering and pagination
- delivery performance tied too closely to filesystem traversal

## What Should Not Change

- Git as canonical content truth
- branch-aware preview
- management write flows committing canonical repo state
- operational metadata and secrets living in PostgreSQL

## What Should Change

- published delivery REST should read from a projection
- published delivery GraphQL should read from the same projection
- search should read from the same projected delivery state
- delivery revision/caching should derive from projected state rather than ad hoc repo reads

## Implementation Shape

The likely end state is:

1. canonical write updates repo-backed content
2. projector reads committed repo state
3. projector writes delivery rows into PostgreSQL
4. published REST and GraphQL read from those rows
5. preview continues to read repo state directly

## Open Questions

- project only the default branch first, or support multiple projected branches
- fully denormalized delivery rows vs more normalized relational tables
- synchronous projection first vs queued worker projection first
- how much delivery search should be handled directly in PostgreSQL before adding anything else

## Guidance For Future Work

Use this note as a direction marker only.

Before implementing anything from it:

1. verify the current code path
2. verify the public docs
3. write the smallest change that moves delivery toward projection-backed reads without weakening Git-backed authoring

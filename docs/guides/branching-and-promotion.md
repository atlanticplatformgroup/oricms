# Branching and Promotion

Use this guide when content changes need review, isolation, or staged release behavior.

## Why Branches Matter

OriCMS is Git-backed, so branches are part of the product model, not an add-on.

They are especially useful when you need to:

- stage a campaign or launch
- isolate large changes
- review work before it reaches the default branch
- coordinate multiple editors without crowding the same branch

## A Typical Branch Workflow

1. Create or switch to a working branch.
2. Make content and schema changes there.
3. Preview that branch.
4. Review the content and diffs.
5. Promote or merge the branch when it is ready.

That flow is straightforward, but it matters because it keeps release behavior explicit.

## What Belongs on a Branch

Branches are most useful for:

- significant editorial changes
- schema or collection work
- coordinated multi-entry updates
- launch content that should not reach the default branch yet

For very small routine edits, working directly on the default branch may still be reasonable.

## Preview Is the Main Checkpoint

Preview is the way to inspect branch state before promotion.

Use it to verify:

- rendered routes
- linked entries
- media references
- branch-specific content changes

If preview is skipped, promotion turns into guesswork.

## Promotion Should Be Explicit

Promotion is the point where reviewed branch work moves forward.

Depending on the project, that may involve:

- a promotion request
- an approval step
- a direct promotion action through a controlled UI

The important rule is that promotion is intentional. It is not just “someone edited content on another branch.”

## Structural Changes Deserve More Care

Schema and collection changes affect more than one entry, so they are good candidates for branch-based work.

Reasons:

- they change editor behavior
- they can invalidate existing content
- they carry more risk than ordinary text edits

## Branches Are Part of the Safety Model

Current collaboration behavior is split on purpose:

- entries use soft coordination and stale-write checks
- structural or destructive flows use harder coordination and locking

Branches are part of that overall safety system. They are not just a Git convenience.

## Related Docs

- [Editing and Publishing](./editing-and-publishing.md)
- [Preview and Delivery](../features/preview-and-delivery.md)
- [Locking and Concurrency](../reference/locking-and-concurrency.md)

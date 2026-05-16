# Editing and Publishing

Use this guide for the normal day-to-day editorial loop in OriCMS.

## The Default Workflow

The intended rhythm is simple:

1. create or open an entry
2. edit it as a draft
3. preview the result
4. mark it ready
5. verify the published output

The underlying workflow is intentionally small:

- stored status values: `draft`, `published`
- UI label: `Ready` for `published`

## Creating Entries

New entries start as drafts.

Two rules matter immediately:

- `$id` is the canonical identifier
- the returned `entryId` or `$id` should be used for follow-up mutations

Do not assume the slug became the entry id.

## Editing Without Losing Work

OriCMS is designed to prevent silent overwrites.

Current behavior:

- presence shows who else is editing
- normal entry editing is not hard-locked
- saves use optimistic concurrency
- stale writes fail instead of replacing newer work

If the system tells you the entry changed since you opened it, refresh and reconcile your edits instead of trying to push through a stale save.

## Preview Is Part of Editing

Preview should not be a final optional check. It is part of the normal editing loop.

Use it to confirm:

- the entry renders correctly
- the route resolves
- related entries and assets appear
- the content is actually ready for published use

## Marking Content Ready

When the interface shows `Ready`, the stored state is `published`.

That matters because published state drives:

- delivery APIs
- frontend integrations
- publish hooks
- downstream builds

In other words, `Ready` is not a soft editorial label. It is the state your delivery path consumes.

## Deleting Content

Treat deletion as a deliberate action, not just another edit.

Before deleting an entry:

- verify the correct `$id`
- check whether other records depend on it
- confirm that the deletion is intentional

That matches the same principle OriCMS already uses for agent-side destructive actions.

## Good Team Habits

- keep content in draft until it is genuinely ready
- preview meaningful changes before publishing
- use branches for larger or review-heavy work
- do not treat a successful save as proof that the frontend result is correct

## Related Docs

- [First Publish](../getting-started/first-publish.md)
- [Branching and Promotion](./branching-and-promotion.md)
- [Astro Integration](../integrations/astro.md)
- [Next.js Integration](../integrations/nextjs.md)

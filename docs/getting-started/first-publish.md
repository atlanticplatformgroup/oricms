# First Publish

This guide walks through the simplest OriCMS editorial loop: draft, preview, mark ready, and verify published output.

## 1. Start With a Draft

Create or open an entry in a collection.

New entries default to:

```text
$status = draft
```

That is the normal starting point for regular authoring.

## 2. Edit the Entry

Use the editor to:

- fill required fields
- add body content
- set metadata such as slug, date, relations, or media

If another person edits the same entry at the same time, OriCMS should reject stale saves instead of silently overwriting them.

## 3. Preview Before You Publish

Preview is branch-aware, so you can inspect the current repository state before releasing anything.

Use preview to answer a few basic questions:

- does the route resolve?
- does the content render correctly?
- do related records and assets appear?
- is this entry actually ready to ship?

## 4. Mark the Entry Ready

The stored workflow values are:

- `draft`
- `published`

In the UI, `published` is shown as `Ready`.

So when the interface says an entry is `Ready`, the stored value is:

```text
$status = published
```

That distinction matters when you work with APIs or frontend integrations.

## 5. Let Your Delivery Path Consume Published Content

What happens next depends on how the project is wired:

- preview-only setups expose the content in preview surfaces
- delivery API setups expose it through REST or GraphQL delivery routes
- frontend setups trigger rebuilds or revalidation through environment hooks

The rule is the same in every case: published content is what your delivery path should consume.

## 6. Verify the Result Where It Matters

Do not stop at “the save worked.”

Check the surface your project actually depends on:

- a delivery REST response
- a GraphQL query
- a preview or live frontend
- a generated build target

## Common Gotchas

### The slug changed, but the entry id did not

That is normal. Use the returned `$id` or `entryId` as the canonical identifier.

### The entry appears in preview but not in published output

Usually one of these is true:

- the entry is still a draft
- the frontend only reads published content
- the publish hook or rebuild target has not run yet

### Another editor changed the entry first

If OriCMS reports a stale revision, refresh and re-apply your edits instead of forcing an overwrite.

## Next

- [Editing and Publishing](../guides/editing-and-publishing.md)
- [Branching and Promotion](../guides/branching-and-promotion.md)
- [Astro Integration](../integrations/astro.md)
- [Next.js Integration](../integrations/nextjs.md)

# Content Modeling

Use this guide when you are deciding what content should exist, how it should be shaped, and where editors will work with it.

Good content models feel boring in the best way. Editors understand them quickly, they hold up under real use, and they do not collapse the moment a new page layout appears.

## Start With Real Records, Not Screens

Model durable things first.

Good starting points:

- `blog-post`
- `author`
- `category`
- `landing-page`
- `feature`

Be careful with screen-shaped types like “homepage hero” or “pricing row” unless that structure is genuinely reusable. Modeling the screen too early usually produces brittle schemas full of one-off fields.

## One Content Type, One Coherent Shape

A content type should describe one kind of record.

Good signs:

- the required fields make sense together
- an editor can tell what the record is for without extra explanation
- validation rules feel obvious

Warning signs:

- the type has too many optional fields for unrelated cases
- it only exists to satisfy a single page layout
- editors routinely ignore half the schema

## Collections Define Editorial Homes

A collection is more than a folder. It gives a content type an operational home inside the project.

It answers practical questions:

- where records are stored in the repository
- how they are listed and browsed
- which content type they use
- what delivery or routing behavior is associated with them

Typical pattern:

- content type: `blog-post`
- collection: `blog-posts`
- path: `content/blog-posts`

## Keep Identity Separate From Presentation

Treat `$id` as the permanent identifier for an entry.

Do not build workflows that assume:

- `slug === $id`
- changing the title should change identity

Use `slug` for routing and presentation. Use `$id` for mutations, history, and references.

## Prefer Structure Over Blobs

If a piece of information matters operationally, give it its own field.

Common examples:

- title
- slug
- summary
- body
- author relation
- publish date
- tags

Large unstructured blobs are fine when the content is genuinely freeform, but they are a poor substitute for field design.

## Reach For Components Early

Components are one of the strongest modeling tools in OriCMS.

Use them when:

- the same structured shape appears in multiple content types
- one field needs repeatable structured items
- a nested section deserves its own schema instead of becoming a pile of prefixed fields

Examples:

- `seo-meta`
- `quote-block`
- `hero-banner`
- `faq-item`

If every repeated item has the same shape, prefer a repeatable `component` field. Use `blocks` only when a single ordered zone must allow mixed component types.

## Model Relationships Intentionally

Use relations when one record really depends on another.

Examples:

- blog post -> author
- product -> category
- landing page -> featured entries

That keeps data from drifting apart and makes browse, preview, and delivery behavior more predictable.

## Design for Editors, Not Just JSON

Before finalizing a model, ask:

- what will editors sort by?
- what will they search by?
- what label makes a record recognizable in a list?

If entries are hard to tell apart in the UI, the model is usually missing a clear title, supporting metadata, or both.

## Design With Git in Mind

OriCMS is Git-backed. Content changes become files and commits, not hidden database updates.

That favors models that are:

- understandable in history views and diffs
- stable across branching and promotion
- not dependent on hidden derived state

## A Good First-Project Pattern

For many teams, this is enough:

1. Define two to four core content types.
2. Create one collection per editorial family.
3. Keep the first version of each schema small.
4. Add relations only when they clearly improve reuse or consistency.
5. Expand the model after editors have used it in real work.

## Related Docs

- [Core Concepts](../getting-started/core-concepts.md)
- [Create Your First Project](../getting-started/first-project.md)
- [Editing and Publishing](./editing-and-publishing.md)
- [Schema Editing](./schema-editing.md)

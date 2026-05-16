# OriCMS Migration Guides

Use this guide when you are moving content from another CMS into OriCMS.

The important thing to get right is not the source platform. It is the migration sequence:

1. decide what the target content model should be
2. create the schemas and collections in OriCMS
3. transform source records into that model
4. import entries and assets in batches
5. validate the result before treating the migration as done

This page is intentionally process-oriented. It does not pretend there is a fully supported one-click migration tool for every source CMS.

## Supported Sources

OriCMS can be a reasonable target for migrations from platforms such as:

- Contentful
- Strapi
- WordPress
- Drupal
- Sanity

The exact extraction path depends on the source platform, but the OriCMS side of the work is usually the same.

## The Target Model In OriCMS

Before exporting anything, decide what the destination should look like.

In OriCMS, that usually means:

- one or more content types
- one or more collections using those content types
- a media strategy for uploaded assets
- a decision about which entries should arrive as `draft` and which should be `published`

Do not start by mirroring the old system field-for-field. Migrations are usually the right moment to simplify naming, remove dead fields, and normalize relationships.

## Recommended Migration Sequence

### 1. Model the destination first

Create the schemas and collections you want to keep long-term.

A migration goes better when the destination model is stable before you begin importing data. If you change the schema every few hundred records, validation and cleanup become much harder.

### 2. Export source data

Use the official export or API surface of the source CMS whenever possible.

Typical examples:

- Contentful: export space data through the CLI or API
- Strapi: export content types, entries, and media through the admin/API path you already use
- WordPress: use the REST API, WXR export, or database-driven exports depending on the install
- Drupal: use JSON:API or custom exports
- Sanity: export documents and assets with the dataset tooling

The exact command is less important than the quality of the exported data. Make sure you can inspect it before you start transforming it.

### 3. Map source concepts to OriCMS concepts

Most migrations eventually reduce to the same mapping questions:

| Source concept | OriCMS concept |
| --- | --- |
| content type / model | content type |
| record / entry / document | collection entry |
| field | schema field |
| media / asset | asset |
| reference / relation | relation or reference field |

The tricky parts are usually:

- rich text formats
- nested repeatable content
- slug and identity handling
- media references
- localized or multi-variant fields

### 4. Transform the data outside OriCMS first

Do the messy normalization work in a standalone transform step before writing into OriCMS.

That usually means:

- flattening or reshaping source payloads
- mapping field names
- converting types
- resolving or staging relationships
- turning source-specific status values into OriCMS `draft` or `published`

By the time data reaches OriCMS, it should already look like the target model.

### 5. Import into OriCMS in batches

Use the current OriCMS management or agent APIs to import data in a controlled way.

In practice:

- create or update entries in batches
- keep asset import separate from entry import when possible
- record source IDs so you can reconcile or rerun safely
- use idempotent import logic on your side so partial reruns do not create chaos

If you use the agent gateway for the write path, follow the normal mutation loop:

1. authenticate
2. call bootstrap
3. inspect allowed collections and workflow rules
4. preflight before risky writes
5. trust returned entry IDs and revisions

Do not base a migration tool on historical helper classes or package examples that are not part of the current supported API flow.

### 6. Validate before publishing broadly

Before you call the migration done, verify:

- content types and collections exist as expected
- entry counts are within the expected range
- asset references resolve
- slugs and canonical IDs behave correctly
- preview works
- published output behaves the way the frontend expects

It is normal to run a dry migration, adjust the transform, and run it again.

## Platform Notes

### Contentful

Contentful migrations usually map cleanly because the source model is already structured.

Watch for:

- locale-heavy payloads
- Rich Text conversion
- linked-entry resolution

### Strapi

Strapi migrations are often straightforward for ordinary collection types, but components and dynamic zones need deliberate mapping.

Watch for:

- nested component structures
- media references
- environment-specific export tooling

### WordPress

WordPress migrations vary the most because the source may be heavily customized.

Watch for:

- posts vs pages assumptions
- ACF-driven field sprawl
- HTML-heavy body content
- media URLs that need to become managed assets

### Drupal

Drupal exports are usually workable, but the source model can be deep and highly customized.

Watch for:

- entity references
- field collections or paragraph-like structures
- rich text normalization

### Sanity

Sanity often maps well conceptually, but portable text and document references need careful handling.

Watch for:

- portable text conversion
- reference graphs
- asset pipeline differences

## What To Avoid

- treating source slugs as guaranteed OriCMS entry IDs
- importing directly into a half-finished schema
- mixing asset upload and entry creation logic into one opaque script
- publishing everything immediately before validating the imported result

## A Good Outcome

A migration has gone well when:

- the target model is cleaner than the source model
- imported content is understandable in the OriCMS editor
- preview and published delivery behave predictably
- the import can be rerun or audited without guesswork

## Related Docs

- [../getting-started/first-project.md](../getting-started/first-project.md)
- [content-modeling.md](./content-modeling.md)
- [editing-and-publishing.md](./editing-and-publishing.md)
- [../agents/api-reference.md](../agents/api-reference.md)

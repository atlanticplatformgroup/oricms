# Schema Editing

Use this guide when creating or evolving content types and component schemas in OriCMS.

## Safe Workflow

1. decide whether the change belongs in a content type or a component schema
2. create or update the schema in the builder
3. choose field types intentionally
4. wire component or blocks fields to the right component schemas
5. configure browse/display fields for content types
6. test the editor with representative entries
7. review how the change affects preview, delivery, and integrations

## Content Types vs Components

Use a content type when you are defining a top-level record such as:

- article
- author
- landing page

Use a component schema when you are defining a reusable nested structure such as:

- callout
- quote block
- FAQ item
- hero section

In the schema workspace, components are not a hidden advanced option. They are a first-class schema mode alongside content types.

## Choosing Between Component and Blocks

When a content type needs nested structure:

- use a repeatable `component` field when every item follows the same schema
- use `blocks` when one ordered zone must allow several component schemas

That distinction matters because `blocks` are more flexible, but also more complex for authors and integrators.

## Field Rules That Matter In Practice

The schema builder supports more than required fields and simple length checks.

Useful options include:

- `pattern` for string-format validation
- `minItems` and `maxItems` for arrays
- `allowCustomValue` for select fields
- `accept` for image file restrictions
- `visibleWhen` for conditional field visibility

Use these to reduce bad content at the source and keep large editors manageable.

A good rule:

- validation should protect data quality
- visibility rules should reduce clutter

Do not use conditional visibility to hide a confusing model that should really be split into clearer components or content types.

## Important Notes

- schema changes are structural changes
- structural changes may use stronger coordination than routine entry edits
- multiple collections can share one content type
- component schemas can be reused across multiple content types

## Related Docs

- [content-modeling.md](./content-modeling.md)
- [../reference/content-types.md](../reference/content-types.md)
- [../reference/component-schemas.md](../reference/component-schemas.md)
- [../reference/field-types.md](../reference/field-types.md)

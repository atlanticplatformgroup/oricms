# Component Schemas

Use this page when you need the component-schema contract itself rather than a broader schema-design guide.

The shared type lives in `packages/shared/src/types.ts` as `ComponentSchema`.

## What A Component Schema Is

A component schema is a reusable structured field group.

It sits alongside content types in the schema builder, not underneath them as a minor option. Content types define whole entry models. Component schemas define nested reusable structures that content types can embed.

In practice, components are what you use when:

- one structured shape should appear in multiple content types
- one field needs repeatable structured items
- a content model needs nested authoring without exploding into dozens of top-level fields

## Current Shape

A component schema defines:

- `$schema`
- `$id`
- `name`
- `label`
- optional `description`
- optional `icon`
- `fields`

The current stored schema marker is:

- `$schema: component-v1`

## Where Components Show Up

Components are selected from content-type fields in two main ways:

- `component`
  - one component schema, optionally repeatable
- `blocks`
  - an ordered zone that allows multiple component schemas from an allowlist

That is why components belong on the same conceptual level as content types. They are not just another primitive like `string` or `number`.

## Component vs Content Type

Use a content type when you are modeling a top-level record family such as:

- `blog-post`
- `author`
- `landing-page`

Use a component schema when you are modeling a reusable nested structure such as:

- `quote-block`
- `callout-block`
- `hero-banner`
- `faq-item`

Good rule:

- content types model records
- components model reusable nested structures inside those records

## Component vs Blocks

These two are related, but not interchangeable.

- `component`
  - one component schema
  - can be made repeatable when every item follows the same structure
- `blocks`
  - mixed component zone
  - use only when one field must contain multiple allowed component types in sequence

If every repeated item has the same shape, prefer a repeatable `component` field over `blocks`.

## Builder Workflow

In the schema workspace, components are created from the same builder surface as content types.

Typical workflow:

1. Create the component schema.
2. Define its fields.
3. Return to the content type.
4. Add a `component` or `blocks` field.
5. Select the component schema from the builder controls.

## Component-Specific Modeling Notes

Components use the same `SchemaField` contract as content types. That means component fields can also use:

- validation rules such as `pattern`, `minItems`, and `maxItems`
- editor-facing options such as `placeholder` and `helpText`
- conditional visibility through `visibleWhen`

This matters because components are not “lightweight fragments.” They can carry real structure and real editing rules.

When a component becomes large or highly stateful, ask whether it is still a reusable nested structure or whether it wants to become a top-level content type with relations instead.

## Related Docs

- [content-types.md](./content-types.md)
- [field-types.md](./field-types.md)
- [../guides/schema-editing.md](../guides/schema-editing.md)
- [../guides/content-modeling.md](../guides/content-modeling.md)

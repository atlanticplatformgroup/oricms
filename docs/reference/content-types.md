# Content Types

Use this page when you need the shape of the content type contract rather than a modeling tutorial.

The shared type lives in `packages/shared/src/types.ts` as `ContentType`.

## What A Content Type Defines

A content type defines:

- `$schema`
- `$id`
- `name`
- `plural`
- `label`
- `labelPlural`
- `description`
- `fields`
- optional browse/display configuration
- optional editor section configuration

In practical terms, the content type is the top-level entry schema editors feel when they work in a collection.

## Fields

Each field has:

- `key`
- `label`
- `type`
- optional validation such as `required`, `unique`, `min`, `max`, `minLength`, `maxLength`
- optional type-specific configuration such as `enumValues`, `relation`, `uidSource`, `component`, `fields`, and `options`

This is where most of the modeling power lives.

Component-bearing fields are especially important:

- `component` fields point to one component schema
- `blocks` fields allow multiple component schemas in one ordered zone

## SchemaField Options

The deeper editing contract lives in `SchemaField.options`.

Important options currently include:

- `choices`
- `placeholder`
- `helpText`
- `defaultValue`
- `pattern`
- `minItems`
- `maxItems`
- `accept`
- `allowCustomValue`
- `visibleWhen`
- `allowedComponents`
- `editor`

These options are how the builder expresses many of the “smaller” but important schema behaviors that shape the editor experience.

### Choices and Select Behavior

For `select`, choices are defined through `options.choices`.

`allowCustomValue` controls whether the field must stay inside the configured choice list or can store values outside it.

Use `enum` when the value set is fixed and should stay tightly modeled. Use `select` when you want a choice-oriented editor control with more runtime configuration.

### Pattern and Array Rules

The current contract supports:

- `pattern` for string validation
- `minItems` / `maxItems` for array validation

These are part of the actual field contract, not just editor hints.

### File Acceptance

`accept` currently matters for image selection and validation. It allows patterns such as:

- `image/*`
- `image/jpeg`
- `.png`

### Conditional Visibility

`visibleWhen` controls whether a field is shown based on another field value.

Current operators are:

- `equals`
- `notEquals`
- `in`
- `notIn`
- `truthy`
- `falsy`

The `field` value can point at nested paths, not just top-level keys.

### Blocks and Allowed Components

For `blocks`, `allowedComponents` defines which component schemas may appear in that zone.

That allowlist is one of the key differences between:

- a repeatable `component` field
- a mixed `blocks` field

## Practical Modeling Advice

Use these options to sharpen an otherwise sound model.

Good examples:

- use `pattern` for a constrained code format
- use `visibleWhen` to hide advanced settings until a toggle is enabled
- use `allowCustomValue` only when editorial flexibility is more important than strict consistency
- use `allowedComponents` to keep a blocks zone focused instead of turning it into an unbounded catch-all

## Display Configuration

The current display contract allows:

- `primary`
- `secondary`
- `media`

These affect how entries present in browse and picker surfaces.

## Editor Sections

The editor contract can define sections so large schemas are grouped in the workspace editor. This is layout metadata, not a second schema system.

## Important Notes

- Content types and collections are distinct. Multiple collections can share one content type.
- Content types and component schemas are also distinct. Content types model top-level records; components model reusable nested structures inside those records.
- `ContentTypeField` is a deprecated alias. `SchemaField` is the current name.
- Field behavior and field capability resolution are separate concerns.

## Related Docs

- [component-schemas.md](./component-schemas.md)
- [field-types.md](./field-types.md)
- [field-capabilities.md](./field-capabilities.md)
- [collections.md](./collections.md)
- [../guides/schema-editing.md](../guides/schema-editing.md)

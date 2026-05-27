# Field Types

Use this page as the quick reference for the built-in field types available when you model content in OriCMS.

The active built-in field registry lives in `packages/web/src/components/fields/registry.tsx`.

## Built-In Field Types

### String-like

- `string`
- `email`
- `url`
- `uid`
- `password`
- `color`

These render with text-style controls. `uid` is typically used when you want a stable identifier derived from another field. `color` uses a color-picker input and is available in the schema builder like the other built-in field types.

### Long text and code-like

- `text`
- `textarea`
- `markdown`
- `json`

These render with longer-form editing controls. `markdown` and `json` are still stored as entry fields, not as a separate page model.

### Numeric and boolean

- `number`
- `boolean`

### Date/time

- `date`
- `datetime`

### Choice fields

- `enum`
- `select`

These support static choices and can also use additional choice metadata from field options.

### Relations and references

- `relation`
- `reference`

Use these when one record needs to point at another.

### Media

- `media`
- `image`

These resolve asset references rather than embedding files directly into entry JSON.

### Structured content

- `object`
- `array`
- `component`
- `blocks`
- `richtext`

Use these when a flat list of string fields is no longer enough.

## Important Notes

- `slug` is not a field type. It is usually modeled with `uid` or `string`.
- `component` is backed by a component schema and represents one structured nested unit.
- `blocks` is a repeatable structured sequence of allowed component schemas.
- `richtext` is a dedicated editor surface, not the same thing as `markdown`.
- components are strong enough to deserve their own schema layer in the builder, not just a passing mention as a field option

## Common Field Options

Many field behaviors are configured through `SchemaField.options`.

Common options include:

- `placeholder`
- `helpText`
- `defaultValue`
- `min` / `max`
- `minLength` / `maxLength`
- `pattern`
- `minItems` / `maxItems`
- `allowCustomValue`
- `accept`
- `visibleWhen`

These options do not apply equally to every field type. The important patterns are:

- text-like fields commonly use `minLength`, `maxLength`, and `pattern`
- number fields commonly use `min` and `max`
- array fields use `minItems` and `maxItems`
- select-style fields can use `choices` and `allowCustomValue`
- image fields can use `accept`
- most fields can use `placeholder`, `helpText`, and `visibleWhen`

## Validation Rules Worth Knowing

### `pattern`

`pattern` applies a regular expression to string values.

Use it when a field must follow a specific shape such as:

- a code
- an external identifier
- a constrained slug-like value

If the regex itself is invalid, the schema configuration is treated as invalid.

### `minItems` and `maxItems`

These apply to `array` fields.

Use them when an editor must provide:

- at least one item
- no more than a fixed number of repeated values

If every repeated item has the same structured shape, a repeatable `component` field is often a better authoring model than a raw `array`.

### `allowCustomValue`

This applies to `select`.

- when `false`, the stored value must be one of the configured choices
- when `true`, the field can accept a value outside the preset list

Use it deliberately. It increases flexibility, but it also weakens consistency for filters, browse views, and integrations.

### `accept`

`accept` currently matters for `image` fields.

It constrains uploaded or selected values to allowed file patterns such as:

- `image/*`
- `image/png`
- `.svg`

Use it when a field should only allow a narrow image subset.

## Conditional Visibility

Fields can declare `options.visibleWhen` so the editor only shows them when another value matches a rule.

Current operators are:

- `equals`
- `notEquals`
- `in`
- `notIn`
- `truthy`
- `falsy`

The rule points at another field through `visibleWhen.field`. That path can target nested values, including array indexes when needed.

Typical examples:

```json
{
  "visibleWhen": {
    "field": "status",
    "operator": "equals",
    "value": "published"
  }
}
```

```json
{
  "visibleWhen": {
    "field": "seo.enabled",
    "operator": "truthy"
  }
}
```

Use conditional visibility to simplify the editor, not to hide a weak model. If a field is only meaningful for one variant of content, the underlying schema should still make sense when read outside the UI.

## Related Docs

- [component-schemas.md](./component-schemas.md)
- [field-capabilities.md](./field-capabilities.md)
- [content-types.md](./content-types.md)
- [../guides/content-modeling.md](../guides/content-modeling.md)

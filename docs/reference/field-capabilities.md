# Field Capabilities

Use this page to understand how OriCMS decides whether a field is useful for browse, sort, search, and readonly display.

The current implementation lives in `packages/shared/src/field-capabilities.ts`.

## What This Controls

Field capability resolution affects:

- collection browse surfaces
- display text in compact lists
- search token generation
- readonly rendering
- relation label fallback behavior

## List-Eligible Field Types

The current implementation treats these as list-eligible by default:

- `string`
- `text`
- `textarea`
- `number`
- `boolean`
- `datetime`
- `date`
- `enum`
- `select`
- `uid`
- `email`
- `url`
- `relation`
- `reference`
- `image`
- `media`

Fields outside that set can still exist in content types, but they are not strong browse defaults.

## Browse Field Selection

When OriCMS chooses browse fields for a collection:

1. it tries the content type display `primary` field
2. it tries the display `secondary` field
3. it fills remaining slots from other list-eligible fields

This keeps collection browse output predictable without requiring every field to be manually configured.

## Search Tokens

Search token generation is type-aware:

- strings and text-like fields contribute plain text tokens
- enum/select fields contribute both labels and raw values
- relation/reference fields contribute both resolved labels and raw ids
- media/image fields contribute asset-derived text
- date/datetime fields contribute formatted display text and sortable tokens

## Readonly Display

Readonly display is not just `String(value)`.

The capability layer is responsible for:

- empty detection
- relation label fallback
- choice label resolution
- media display text
- consistent boolean/date formatting

## Why This Matters

If a field type changes, browse/search/readonly behavior may change with it. That is why capability behavior belongs in shared code, not in one UI component.

## Related Docs

- [field-types.md](./field-types.md)
- [collections.md](./collections.md)

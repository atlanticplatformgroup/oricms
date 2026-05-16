# Schemas and Content Types API

Use this route family for content model management.

## Current Surface

- content type CRUD
- list and single-type reads
- create, update, and delete for content types stored under `schemas/types`

## Notes

- schema and content type changes are structural
- these routes may be protected by hard locks
- this route family currently manages content types, not a second public component-schema API surface

## Related Docs

- [../content-types.md](../content-types.md)
- [../locking-and-concurrency.md](../locking-and-concurrency.md)

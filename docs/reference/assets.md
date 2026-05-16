# Assets

Use this page when you need the asset model itself rather than a media-management walkthrough.

The shared types live in `packages/shared/src/types.ts` as `Asset`, `AssetMetadata`, and `AssetReference`.

## Asset Shape

Project-scoped assets include:

- `path`
- `name`
- `folder` for the physical parent directory
- `size`
- `type`
- `url`
- `lastModified`
- optional `metadata`
- optional usage summary/detail

Global assets add:

- `assetId`
- `scope: global`

## Metadata

Current metadata includes:

- `altText`
- `caption`
- `tags`

`metadata.folder` is a legacy compatibility field. New writes should normalize toward tags instead of relying on that older single-folder model.

## References

Asset references are structured objects, not raw path strings.

Current scopes:

- `project`
- `global`

Project references store the asset `path`.

Global references store `assetId`.

## Usage Tracking

The product can expose asset usage summary and detail information so teams can see whether an asset is used, unused, or referenced in places they did not expect.

## Related Docs

- [field-types.md](./field-types.md)
- [../guides/media-management.md](../guides/media-management.md)

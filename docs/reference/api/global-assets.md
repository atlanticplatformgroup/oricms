# Global Assets API

Use the global-assets API for project-level shared assets that are not scoped to a single collection entry.

## Base Route

```text
/api/v1/projects/:projectId/global-assets/*
```

## Current Surface

- `GET /`
- `POST /upload`
- `GET /raw/:assetId`
- `GET /:assetId`
- `PUT /metadata/:assetId`
- `DELETE /:assetId`

## What Makes This Surface Different

The regular assets API includes entry-aware filtering and usage workflows. Global assets are simpler:

- they belong to the project
- they are stored in the repository
- they can be read, uploaded, updated, and deleted without an entry relationship

This makes them suitable for shared media such as brand assets, icons, or other files a project wants to reuse broadly.

## Notes

- uploads currently accept a limited file-extension allowlist
- metadata updates are a separate route from upload
- raw reads stream the asset binary rather than returning metadata

## Related Docs

- [assets.md](./assets.md)
- [../assets.md](../assets.md)

# Collections and Entries API

Use this route family for collection configuration, entry CRUD, entry history inspection, and branch-transfer workflows.

## Current Surface

- collection list, bulk update, and collection delete
- entry create, update, delete
- entry list and single-entry reads
- entry history and point-in-time inspection
- entry branch-transfer preview and apply

Current route shape includes:

- `GET /api/v1/projects/:projectId/collections`
- `PUT /api/v1/projects/:projectId/collections`
- `DELETE /api/v1/projects/:projectId/collections/:collectionId`
- `GET /api/v1/projects/:projectId/collections/:collectionId`
- `GET /api/v1/projects/:projectId/collections/:collectionId/:id`
- `POST /api/v1/projects/:projectId/collections/:collectionId`
- `PUT /api/v1/projects/:projectId/collections/:collectionId/:id`
- `DELETE /api/v1/projects/:projectId/collections/:collectionId/:id`
- `GET /api/v1/projects/:projectId/collections/:collectionId/:id/history`
- `GET /api/v1/projects/:projectId/collections/:collectionId/:id/history/:hash`
- `POST /api/v1/projects/:projectId/collections/:collectionId/:id/branch-transfer/preview`
- `POST /api/v1/projects/:projectId/collections/:collectionId/:id/branch-transfer/apply`

## Notes

- `GET /collections/:collectionId` is the entry-list route for that collection, not a separate collection-config detail route
- collection configuration is updated as a full collection-array payload via `PUT /collections`
- entry identity is `$id`
- workflow state persists through `$status`
- stale revision and lock behavior may affect writes
- normal reads and writes run against the project default branch unless the route explicitly accepts branch input
- entry history and point-in-time reads accept an optional `branch` query parameter
- restore is currently a higher-level workflow built on history inspection plus a normal mutation, not a dedicated public route

## Related Docs

- [../collections.md](../collections.md)
- [../entries.md](../entries.md)
- [../locking-and-concurrency.md](../locking-and-concurrency.md)

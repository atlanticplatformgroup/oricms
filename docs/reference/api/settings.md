# Settings API

Use this route family for project-level configuration and related administrative settings.

## Current Surface

- project list, create, detail, update, and delete
- project settings
- environments
- branch mappings
- delivery-key and Git configuration routes
- workspace system-surface reads
- workspace catalog reads
- workspace UI-group list/detail/create/update/delete

Current delivery-key routes:

- `GET /api/v1/projects/:projectId/delivery-key`
- `POST /api/v1/projects/:projectId/delivery-key`
- `DELETE /api/v1/projects/:projectId/delivery-key`

Current workspace-management routes:

- `GET /api/v1/projects/:projectId/system-surfaces`
- `GET /api/v1/projects/:projectId/workspace-catalog`
- `GET /api/v1/projects/:projectId/ui-groups`
- `GET /api/v1/projects/:projectId/ui-groups/:uiGroupId`
- `POST /api/v1/projects/:projectId/ui-groups`
- `PATCH /api/v1/projects/:projectId/ui-groups/:uiGroupId`
- `DELETE /api/v1/projects/:projectId/ui-groups/:uiGroupId`

## Notes

- these routes are project-scoped
- many settings mutations are hard-lock protected
- members and agent-member administration are related project APIs, but they are documented separately in the product and agent docs rather than treated as one settings surface

## Related Docs

- [../../configuration/README.md](../../configuration/README.md)
- [../locking-and-concurrency.md](../locking-and-concurrency.md)

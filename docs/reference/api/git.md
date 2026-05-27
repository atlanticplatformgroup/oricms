# Git API

Use the git API for project repository state, branch operations, promotion flows, and repository history.

## Base Route

```text
/api/v1/projects/:projectId/git/*
```

## Repository Surface

- `GET /status`
- `POST /sync`

These routes cover repository health and synchronization work for the project workspace.

## Branch Surface

- `GET /branches`
- `GET /branches/compare`
- `GET /branches/diff-summary`
- `POST /branches`
- `POST /branches/switch`
- `PATCH /branches/:branchName`
- `DELETE /branches/:branchName`

These routes cover branch listing, comparison, creation, switching, renaming, and deletion. Branch mutations also respect project locks and protected-branch rules.

## Promotion Surface

- `GET /promotions`
- `POST /promotions/request`
- `POST /promotions/:requestId/approve`
- `POST /promotions/:requestId/reject`
- `GET /promotions/conflicts/file`
- `POST /promotions/resolve`
- `POST /promote`

Promotion routes coordinate review and merge behavior between branches. They rely on audit-log backed promotion requests rather than a separate promotion table.

## History Surface

- `GET /history`
- `GET /history/diff`
- `GET /history/file`

These routes expose commit history and file inspection for repository-backed project content.

## Schema Surface

- `GET /schemas`
- `GET /schemas/types`
- `GET /schemas/components`
- `GET /schemas/*`
- `POST /schemas/*`
- `DELETE /schemas/*`

These routes are the legacy repository-path schema helpers. They still exist for direct git-backed schema file reads and writes, even though the main product-facing schema workflows now center on the content-type and collections APIs.

## Notes

- schema editing has two surfaces today:
  - the product-facing content-type and collections APIs
  - the lower-level git-backed `/schemas/*` routes documented above
- promotion flows and branch mutation routes can be blocked by hard locks

## Related Docs

- [../history-and-restore.md](../history-and-restore.md)
- [../../guides/branching-and-promotion.md](../../guides/branching-and-promotion.md)

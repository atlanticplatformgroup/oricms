# Permissions Matrix

Use this page when you need the current role/resource/action matrix without the surrounding policy discussion.

The source of truth lives in `packages/shared/src/types.ts` as `ROLE_PERMISSION_MATRIX`.

## Roles

- `owner`
- `admin`
- `editor`
- `viewer`

## Resources

- `schemas`
- `assets`
- `settings`
- `members`
- `agents`
- `contentTypes`
- `collections`

## Effective Matrix

| Resource | Owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- |
| `schemas` | create, read, update, delete | create, read, update, delete | none | none |
| `contentTypes` | create, read, update, delete | create, read, update, delete | none | none |
| `collections` | create, read, update, delete, publish | create, read, update, delete, publish | create, read, update, publish | none |
| `assets` | create, read, update, delete | create, read, update, delete | create, read, update | read |
| `settings` | read, update | read, update | none | none |
| `members` | create, read, update, delete | create, read, update, delete | none | none |
| `agents` | create, read, update, delete | create, read, update, delete | none | none |

## Important Notes

- Humans and agents share this same underlying permission model.
- Agent branch constraints, collection allowlists, and write policies are operational constraints layered on top.
- `publish` is currently meaningful on collection-entry workflows.
- `none` means the shared contract does not grant that role the action on that resource.
- Do not infer extra read access from the UI alone. In the current shared matrix, `viewer` is only guaranteed asset read access.

Read this table as the baseline contract. Project configuration and agent-scoping rules can narrow behavior further, but they should not contradict the underlying role model.

## Related Docs

- [../product/permissions-model.md](../product/permissions-model.md)
- [locking-and-concurrency.md](./locking-and-concurrency.md)

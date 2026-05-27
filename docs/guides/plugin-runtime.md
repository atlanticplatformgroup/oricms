# Plugin Runtime

Use this guide when operating plugin behavior from the OriCMS side.

## Current Concerns

The plugin runtime currently involves:

- manifests stored in the project repository
- execution policy
- hook endpoint configuration
- secrets
- health and reconcile flows
- UI contribution policy

## Recommended Operational Posture

- keep execution policy narrow
- rotate secrets intentionally
- treat policy previews and rollback previews as part of normal operations
- treat runtime failures as real operational issues, not silent background noise

## Related Docs

- [../reference/api/plugins.md](../reference/api/plugins.md)
- [../reference/webhooks.md](../reference/webhooks.md)
- [../extensions/plugin-authoring.md](../extensions/plugin-authoring.md)

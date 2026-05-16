# Plugins

Plugins are the current extension surface for project-specific behavior.

In practice, plugins let a project declare integration behavior instead of hard-wiring every downstream action into core.

## What The Feature Does

- plugin manifests live in the project repository
- plugin enablement and policy are project-scoped
- webhook delivery and lifecycle hooks are the current extension runtime

That means plugin behavior is explicit, inspectable, and tied to the project rather than hidden in instance-wide custom code.

## Related Docs

- [../extensions/plugin-authoring.md](../extensions/plugin-authoring.md)
- [../configuration/plugins.md](../configuration/plugins.md)
- [../reference/webhooks.md](../reference/webhooks.md)

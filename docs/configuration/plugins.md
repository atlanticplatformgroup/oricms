# Plugin Configuration

Plugin configuration is project-scoped. It controls which plugins are active for a project and how those plugins are allowed to interact with it.

That distinction matters because plugin behavior should be intentional, not ambient. A plugin is not “just on” everywhere by default.

## What Plugin Configuration Covers

In practice, plugin configuration includes things like:

- enabled plugin ids
- hook endpoint configuration
- retry settings
- execution policy
- UI contribution allowlists
- per-plugin secret metadata

## Where It Lives

Plugin configuration is stored in project settings and interpreted by the plugin settings and dispatch code in the API.

## When You Touch It

Configure plugins when you need to:

- enable or disable a plugin for a project
- set hook endpoints for declared plugin events
- rotate or revoke plugin secrets
- restrict UI contributions or webhook dispatch behavior

## Guardrails

Keep plugin configuration disciplined:

- only configure declared hooks
- keep execution policy project-scoped
- do not treat project plugin configuration as instance-wide policy unless the code explicitly supports it

## Related Docs

- [deployment-and-build-hooks.md](./deployment-and-build-hooks.md)
- [../extensions/plugin-authoring.md](../extensions/plugin-authoring.md)
- [../reference/api/plugins.md](../reference/api/plugins.md)

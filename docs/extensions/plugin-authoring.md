# Plugin Authoring

Use this page to understand the current plugin authoring surface.

## Current Model

Plugins are described by manifests and governed by project plugin settings.

The important boundary is:

- the manifest lives in the managed project repository
- the receiving webhook or external service can live anywhere you host it

OriCMS does not currently load arbitrary plugin server code from the monorepo or from the project repo. The stable plugin seam today is manifest-driven plus webhook delivery.

The shared manifest type includes:

- `id`
- `name`
- `version`
- `description`
- optional capability flags
- optional hook declarations
- optional UI contribution declarations

## Where A Plugin Goes

Put the manifest in the project repository under `plugins/`.

Current manifest discovery paths are:

- `plugins/*.yaml`
- `plugins/*.yml`
- `plugins/*/plugin.yaml`
- `plugins/*/plugin.yml`

That means a project repo can look like:

```text
my-project-repo/
├── content/
├── schemas/
└── plugins/
    ├── seo-tools.yaml
    └── webhook-dispatcher/
        └── plugin.yaml
```

The hosted receiver for that plugin does not need to live in this repo. The repo stores the manifest and the project settings store runtime policy, endpoints, and secrets.

## What Plugins Can Affect Today

The current documented surface is centered on:

- hook dispatch
- execution policy
- secrets
- runtime health/reconciliation
- UI contribution allowlisting

## Stable Enough To Build Against

The defensible current surface is:

- project-repository manifests under `plugins/`
- declared hook names
- project-level enablement and policy
- webhook delivery with signing and retry behavior
- UI contribution declarations filtered by project UI policy

## Practical Authoring Flow

Today the safest plugin workflow is:

1. add a manifest under the project repo `plugins/` directory
2. declare only the hooks and UI contributions the plugin really needs
3. enable the plugin in project settings
4. configure hook endpoints and secrets from the OriCMS side
5. implement and host the receiver service separately

Think of the current plugin model as “repo-declared integration contracts,” not “installable in-process app modules.”

## Not A Marketplace Yet

Do not treat the current plugin model as a full package ecosystem.

The following are still intentionally limited:

- discovery and installation from remote sources
- version negotiation between plugins and host
- generalized plugin dependency management
- a broad public runtime API for arbitrary server code

## Important Constraint

The plugin runtime is real, but the extension authoring surface is still narrower than a mature app marketplace model. Plugin authors should treat only the documented contracts as stable.

## Related Docs

- [webhook-contracts.md](./webhook-contracts.md)
- [plugin-hook-signing.md](./plugin-hook-signing.md)
- [../configuration/plugins.md](../configuration/plugins.md)
- [../reference/api/plugins.md](../reference/api/plugins.md)

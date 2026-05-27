# Builds and Environments

Builds and environments are what connect editorial changes to real frontend targets.

Without them, publishing only changes project content. With them, publishing can also drive preview sites, production deploys, revalidation hooks, and other downstream work.

## What The Feature Does

- environments describe targets
- branch mappings decide where a branch publishes
- build and revalidation flows can be triggered after publish operations

This is the feature layer that turns OriCMS from an editor into part of a release pipeline.

## Related Docs

- [../configuration/environments-and-branch-mappings.md](../configuration/environments-and-branch-mappings.md)
- [../configuration/deployment-and-build-hooks.md](../configuration/deployment-and-build-hooks.md)
- [../reference/builds-and-cdn.md](../reference/builds-and-cdn.md)

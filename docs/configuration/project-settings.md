# Project Settings

Project settings define the identity and default behavior of an OriCMS project.

This is the configuration layer you touch when a project needs to be renamed, re-scoped, or prepared for integrations.

## What Project Settings Cover

Project settings currently include:

- project name and slug
- default branch
- project-level metadata used by the admin app and API
- settings payloads consumed by plugins, delivery systems, and related subsystems

## Why They Matter

Three rules matter here:

- the project is the main tenancy boundary
- settings are project-scoped, not instance-scoped
- the default branch affects publishing and delivery behavior

Changing project settings is not just cosmetic. It can change how other parts of the system behave.

## Where Project Settings Show Up

You will see project settings reflected in:

- the Settings area of the admin app
- project route families in the API
- plugin and environment configuration
- audit and automation behavior that depends on project configuration

## When to Touch This Surface

Use project settings when you need to:

- rename or re-identify a project
- change the default branch
- review the baseline configuration before wiring environments or plugins

## Related Docs

- [Environments and Branch Mappings](./environments-and-branch-mappings.md)
- [Plugin Configuration](./plugins.md)
- [Project Settings Guide](../guides/project-settings.md)

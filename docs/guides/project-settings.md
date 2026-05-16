# Project Settings

Use this guide when you are configuring how a project behaves rather than editing its content.

Project settings are where OriCMS stops being “just a content workspace” and becomes an operating environment. Changes here affect publishing, environments, Git behavior, and integrations.

## What Lives In Project Settings

Depending on the project, settings usually include:

- general settings
- environments
- branch mappings
- Git configuration
- delivery configuration
- plugin runtime settings

These are not routine editorial changes. They shape how the rest of the project behaves.

## A Safe Order To Work In

If you are setting up or revisiting a project, this order tends to keep things clear:

1. Define the project’s preview and live environments.
2. Decide which branches map to those environments.
3. Confirm what should happen after publish: webhook, build, revalidation, or nothing.
4. Only then enable any automatic deployment or publish-driven behavior.

That order prevents a lot of “why did this publish hit the wrong target?” confusion.

## Treat Settings As Operational Work

Project settings deserve a little more caution than ordinary content edits.

In practice that means:

- make changes intentionally
- know which environment or branch a change affects
- expect some settings to be effectively infrastructure, not editorial preferences
- avoid casual edits during active publishing unless you understand the downstream impact

## Related Docs

- [branching-and-promotion.md](./branching-and-promotion.md)
- [builds-and-revalidation.md](./builds-and-revalidation.md)

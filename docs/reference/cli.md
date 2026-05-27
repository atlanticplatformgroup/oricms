# CLI

Use this page to understand the current OriCMS CLI surface.

## Top-Level Commands

The current CLI exposes:

- `login`
- `logout`
- `whoami`
- `project`
- `init`
- `start`
- `deploy`
- `cdn`
- `export`

## Authentication

Authentication commands are:

- `oricms login`
- `oricms logout`
- `oricms whoami`

Important options on `login`:

- `--url` to target a non-default API URL
- `--email` and `--password` for non-interactive login
- `--github` for the OAuth flow

The CLI is project-based. Historical `site` command examples should not be treated as current.

## Project Commands

The `project` group currently includes:

- `oricms project list`
- `oricms project create`
- `oricms project switch`
- `oricms project current`

Notable options:

- `project list --json`
- `project create --name --description --default`

`project create` generates a slug from the project name and retries with a suffixed slug if the first choice is taken.

## Local Setup Commands

Use these commands for local workspace setup:

- `oricms init [directory]`
- `oricms start`

Notable `init` options:

- `--name`
- `--project`
- `--repo`
- `--slug`
- `--template`
- `--skip-install`

`init` still supports the CLI-managed repository URL flow. It is not the same thing as the main web onboarding flow.

Notable `start` options:

- `--detach`
- `--build`

## Deploy and CDN Commands

Deployment-oriented commands are:

- `oricms deploy`
- `oricms cdn export`
- `oricms cdn list`
- `oricms cdn delete`
- `oricms cdn cleanup`

Notable `deploy` options:

- `--build`
- `--env`
- `--preview`
- `--sync`

The `cdn` subcommands are direct storage helpers. They require provider/bucket credentials and are separate from the project-scoped CDN API.

## Export Command

The export surface is:

- `oricms export astro`
- `oricms export nextjs`

Notable options:

- `--source`
- `--repo`
- `--branch`
- `--token`
- `--out`
- `--types`
- `--assets`
- `--format`

## Source of Truth

The current command surface is implemented in:

- `packages/cli/src/index.ts`
- `packages/cli/src/commands/*`

## Related Docs

- [../integrations/astro.md](../integrations/astro.md)
- [../integrations/nextjs.md](../integrations/nextjs.md)
- [../getting-started/quickstart.md](../getting-started/quickstart.md)

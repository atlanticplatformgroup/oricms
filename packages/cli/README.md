# @oricms/cli

CLI tooling for working with OriCMS projects and exporting content to supported frontend adapters.

## Current Scope

The current CLI supports:

- authentication helpers
- project selection and switching
- local project initialization
- local dev startup helpers
- CDN/deploy helpers
- content export for Astro and Next.js

## Important Terminology

The live CLI is project-based.

Use:

- `oricms project list`
- `oricms project create`
- `oricms project switch`
- `oricms project current`

Do not rely on older `site` command examples from historical docs.

## Installation

```bash
npm install -g @oricms/cli
# or
npx @oricms/cli
```

## Common Commands

```bash
# Authenticate
oricms login
oricms whoami
oricms logout

# Work with projects
oricms project list
oricms project create --name "My Project"
oricms project switch <project-id>
oricms project current

# Initialize a local workspace
oricms init my-project

# Start the Docker Compose stack
oricms start --detach

# Export to a supported frontend
oricms export astro --source ./repo --out ./astro-site
oricms export nextjs --source ./repo --out ./next-site

# Deploy or manage storage output
oricms deploy --build ./dist
oricms cdn list --provider s3 --bucket my-bucket --prefix deploys/
```

`oricms project create` generates a slug from the project name and will retry with a suffixed slug if the first choice is already taken.

## Command Groups

### Authentication

- `login`
- `logout`
- `whoami`

Useful `login` options:

- `--url`
- `--email`
- `--password`
- `--github`

### Projects

- `project list`
- `project create`
- `project switch`
- `project current`

Useful options:

- `project list --json`
- `project create --name --description --default`

### Local Setup

- `init`
- `start`

Useful `init` options:

- `--project`
- `--repo`
- `--slug`
- `--template`
- `--skip-install`

Useful `start` options:

- `--detach`
- `--build`

### Deploy and CDN

- `deploy`
- `cdn export`
- `cdn list`
- `cdn delete`
- `cdn cleanup`

Useful `deploy` options:

- `--build`
- `--env`
- `--preview`
- `--sync`

Useful `cdn` options vary by subcommand, but all current storage helpers center on provider, bucket, credentials, and optional prefix/endpoint settings.

## Export Targets

Current built-in export targets:

- `astro`
- `nextjs`

## Source of Truth

For the current command surface, prefer the implementation in:

- `src/index.ts`
- `src/commands/*`

For product-level documentation, prefer the docs tree under `/docs`.

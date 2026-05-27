# Git Integration Architecture

> **Pattern:** Server-side Git as content source of truth
> **Status:** Current

## Overview

OriCMS uses Git as the source of truth for content, schemas, and collection configuration.

Clients do not talk to Git directly.

Instead:

- the web app and agents call the API
- the API performs Git operations server-side
- project repositories are cloned or initialized into managed workspace directories

## Core Principles

1. **Git stays server-side**
2. **Repositories are project-scoped**
3. **Content is file-backed, not row-backed**
4. **Mutations are committed through application services**
5. **Branch-aware workflows are first-class**

## Current Repository Shape

The current collections-based repo model is:

```text
repo/
├── oricms/
│   └── collections.json
├── schemas/
│   └── types/
│       └── *.json
├── content/
│   └── <collection-path>/
│       └── <entryId>.json
└── assets/
```

Important implications:

- collections decide where entries live
- schemas define entry structure
- entries are plain files in the repo
- Git history is the content history

## Main Runtime Pieces

### GitService

`packages/api/src/git/service.ts`

Responsible for:

- initializing local repos for managed local projects
- cloning remote repos
- pulling and pushing
- branch operations
- history and diff operations
- path-safe file reads and writes
- serializing project Git work with per-project mutexes

### CollectionService

`packages/api/src/collections/service.ts`

Responsible for higher-level content behavior on top of Git:

- reading collection config
- loading entries from repo files
- validating writes
- saving entry files
- revision generation
- stale-write protection
- collection indexing and search helpers

### Project Routes

The API mounts Git and content workflows under project routes such as:

- `/api/v1/projects/:projectId/git/*`
- `/api/v1/projects/:projectId/collections/*`
- `/api/v1/projects/:projectId/content-types/*`

## Workspace Model

Each project gets a managed workspace:

```text
WORKSPACE_ROOT/
└── <projectId>/
    └── repo/
```

That workspace is where server-side Git commands run.

If a project has no remote repository yet, OriCMS can initialize a managed local repo and commit an initial README.

## Why Git Is Kept Server-Side

### Security

- repository credentials stay on the server
- branch and write rules are enforced centrally
- raw repository access is not exposed to browsers

### Consistency

- one Git implementation path
- predictable branch behavior
- centralized logging and error handling
- controlled retry and lock behavior

### Product Fit

OriCMS wants Git history, branching, and rollback as built-in product behavior rather than as a separate export step.

## Branching Model

Branches are part of normal authoring and release workflows.

Current system capabilities include:

- branch listing and switching
- branch creation, rename, and delete
- branch-aware entry reads
- history by branch
- promotion flows between branches
- branch-aware build and environment mapping

The API treats branch as part of the content context, not as an external developer-only concern.

## Mutation Flow

At a high level, a content write looks like this:

1. authenticate user or agent
2. check project membership and permissions
3. load collection config and schema
4. validate data
5. write file changes into the project workspace
6. commit through Git service
7. push or preserve locally depending on project setup
8. invalidate caches and emit downstream effects

For agents, this may also include:

- preflight validation
- idempotency handling
- delete confirmation
- workflow transition rules

## Concurrency and Safety

Current safeguards include:

- per-project Git mutexes in `GitService`
- lock service coverage for structural/high-impact operations
- optimistic concurrency for entry edits via revision checks
- path validation to prevent directory traversal

These controls matter because Git is shared mutable state at the project level.

## Managed Local vs Remote Repos

OriCMS supports both:

### Managed local repo

- no remote `repoUrl`
- repo is initialized locally
- useful for local development and self-contained setups

### Remote repo

- project has a `repoUrl`
- API clones and syncs with the remote
- git credentials come from project git config

The application behavior above the Git layer stays largely the same in both cases.

## Delivery and Build Relationship

Git is the authoring source of truth, but delivery is a separate concern.

After commits:

- preview can read branch-aware repo state
- build/export flows can materialize deployable output
- adapters such as Astro and Next.js consume the repo shape directly

That separation is important:

- Git stores source content
- builds and adapters turn that source into deployed frontends or headless consumers

## Current Constraints

OriCMS is Git-backed, not Git-native in the sense of exposing full Git semantics everywhere.

The platform still chooses which Git operations are safe to expose:

- curated route surface instead of arbitrary git command execution
- application validation before file writes
- permission-aware branch operations
- product-specific promotion workflows instead of generic merge tooling everywhere

## References

- [Architecture Overview](./overview.md)
- [Multi-Tenancy Architecture](./multi-tenancy.md)
- [API Overview](../reference/api-overview.md)

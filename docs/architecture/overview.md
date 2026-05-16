# OriCMS Architecture Overview

> **Feature:** System architecture
> **Status:** Current

## Overview

OriCMS is a project-centric CMS powered by Git. Each project maps to a repository, and the platform layers authenticated management APIs, structured editing, preview, builds, media management, and AI governance on top of that repository.

## Architecture Principles

1. **Git is the source of truth** for content, schemas, and collection configuration.
2. **Projects are the primary tenancy boundary** in the current codebase.
3. **Permissions gate both UI and API behavior**.
4. **Git operations stay server-side** through the API.
5. **Humans and agents share one membership model** with different authentication paths.

## Major Runtime Pieces

### Web App
- React 18
- Vite 5
- Mantine
- TanStack Query
- React Router
- TipTap and CodeMirror for rich text and structured editing surfaces

### API
- Express
- Prisma
- PostgreSQL
- simple-git
- Zod
- Socket.IO

### Supporting Packages
- `@oricms/client` TypeScript SDK
- `@oricms/cli`
- `@oricms/astro`
- `@oricms/nextjs`

## Live Route Model

The active management API is mounted under project routes:

- `/api/v1/projects`
- `/api/v1/projects/:projectId/git`
- `/api/v1/projects/:projectId/content-types`
- `/api/v1/projects/:projectId/collections`
- `/api/v1/projects/:projectId/assets`
- `/api/v1/projects/:projectId/preview`
- `/api/v1/projects/:projectId/builds`
- `/api/v1/projects/:projectId/cdn`
- `/api/v1/projects/:projectId/graphql`

Public delivery routes are mounted separately:

- `/api/v1/delivery/projects/:projectId/collections`
- `/api/v1/delivery/projects/:projectId/graphql`

The agent gateway is mounted at:

- `/api/v1/agent/v1/*`

## Relational Data Model

The relational layer is smaller than the Git-backed content layer, but it is still broader than the core project tables alone.

Current Prisma models are:

- `User`
- `Session`
- `Project`
- `ProjectMember`
- `ProjectInvite`
- `ProjectGitConfig`
- `AuditLog`
- `Build`
- `CdnConfig`
- `CdnExport`
- `AgentAccess`
- `AgentConsent`
- `AgentAuditLog`
- `AgentToken`
- `AgentWriteConfig`
- `AgentChangeRequest`
- `ResourceLock`
- `BranchEnvironmentMapping`

The architectural split is:

- PostgreSQL stores users, auth sessions, membership, audit, locks, builds, CDN state, and agent-control state
- Git-backed repositories remain canonical for entries, content types, component schemas, collection configuration, and assets
- PostgreSQL also stores the published delivery projection used by delivery REST and delivery GraphQL

That split matters. OriCMS is not “database content with a Git export.” The repository remains the primary content source of truth.

## Key Enums and States

The current database enums that shape product behavior are:

- `UserType`
- `ProjectRole`
- `BuildStatus`
- `CdnExportStatus`
- `AgentWriteMode`
- `ChangeStatus`

The most important operational state groups are:

- builds: `pending`, `running`, `success`, `failed`, `cancelled`
- CDN exports: `pending`, `uploading`, `invalidating`, `completed`, `failed`
- agent write modes: `HUMAN_REVIEW`, `AUTO_PUBLISH`, `BRANCH_BASED`

Content entries and collection manifests remain Git-backed rather than primarily database-backed.

## Current Product Architecture

### Content Layer
- Content types define schemas.
- Collections define storage path, routing, and editor behavior.
- Entries are stored in the repository and versioned by Git.

### Collaboration Layer
- Members manage human and AI access from one surface.
- Roles remain owner/admin/editor/viewer.
- Permissions are enforced in middleware and respected in the UI.

### Git Workflow Layer
- Branch switching and promotion flows are first-class.
- Entry history is branch-aware.
- Visual diffs are now part of the history experience.

### Delivery Layer
- Preview routes read repository state by branch or ref.
- Delivery REST and GraphQL endpoints expose the published projection derived from the repository.
- CDN/build routes support deployment workflows.

## Current Reality vs Older Docs

- The active UI is Mantine based; older Radix/Tailwind/shadcn guidance should be treated as stale.
- The codebase is predominantly `project`-based; older `site` terminology now mostly survives in compatibility layers, migrations, and internal history.
- The legacy Pages/Singles model has been removed in favor of universal collections.
- Browse/list semantics now flow through a shared field capability contract and section-level browse models instead of ad hoc UI-only transforms.

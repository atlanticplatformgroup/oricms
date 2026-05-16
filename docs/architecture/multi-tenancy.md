# Multi-Tenancy Architecture

> **Pattern:** Row-level tenancy with per-project repository isolation
> **Status:** Current

## Overview

OriCMS is project-centric.

Each project is the primary tenancy boundary for:

- membership
- permissions
- repository workspace
- settings
- builds
- CDN/export configuration
- agent access

The database is shared across all projects, but operational state and content access are scoped by `projectId`.

## Current Isolation Model

OriCMS uses two layers of isolation:

1. **Shared database with project-scoped rows**
2. **Dedicated repository workspace per project**

That means:

- product metadata lives in PostgreSQL
- content and schemas live in Git-backed project repos
- APIs always resolve work in the context of a specific project

## Primary Project Entities

The current Prisma schema includes a wider project-scoped operational model than just the top-level project tables.

Core project entities:

- `Project`
- `ProjectMember`
- `ProjectInvite`
- `ProjectGitConfig`

Project-scoped operational entities:

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

Humans and agents both attach to projects through membership:

- `User`
- `Session`
- `ProjectMember`
- `UserType = HUMAN | AGENT`

This is important architecturally because agents are not a separate authorization system. They are members with a different authentication path.

## Repository Isolation

Each project gets its own workspace directory under the configured workspace root.

Current default pattern:

```text
WORKSPACE_ROOT/
└── <projectId>/
    └── repo/
```

Within the repo, OriCMS expects a collections-based structure:

```text
repo/
├── oricms/
│   └── collections.json
├── schemas/
│   └── types/
│       └── *.json
├── content/
│   └── <collection-path>/
│       └── *.json
└── assets/
```

Projects do not share repository directories.

## Membership and Permission Isolation

Membership is enforced through `ProjectMember`.

Current roles remain:

- `owner`
- `admin`
- `editor`
- `viewer`

Permissions are checked against:

- `projectId`
- `userId`
- project role
- resource/action permission rules

This isolation applies equally to:

- API requests
- UI state
- agent requests
- audit logging

## Settings and Operational Isolation

Every project owns its own:

- git configuration
- branch settings
- branch-environment mappings
- resource locks
- build history
- CDN/export configuration
- agent access configuration
- agent consent and token state
- agent write-review state
- invites and members
- audit history

This allows two projects to share application infrastructure while still behaving as separate CMS instances from the user’s perspective.

## Agents in the Tenancy Model

Agents are project-scoped members.

Important properties:

- an agent token belongs to one project
- the token resolves to one agent user/member
- the agent inherits a project role
- project-level agent config can further narrow branches and collections

This means agent access is tenant-aware by construction rather than bolted on afterward.

## Why This Model Works

This approach keeps OriCMS operationally simple:

- one application deployment
- one database
- one permission model
- one membership model

While still preserving strong boundaries at the project level:

- repository isolation
- project-scoped metadata
- project-scoped authz decisions
- project-scoped audit trails

## State That Still Matters Across Projects

A few tables are intentionally global rather than tenant-local:

- `User`
- `Session`

Those models support shared identity and authentication, while project membership and project-owned operational records keep actual CMS access scoped to a project.

## Current Constraints

This is not infrastructure-per-tenant isolation.

OriCMS does **not** currently provide:

- separate database per project
- separate application deployment per project
- separate queue cluster per project

Instead, the isolation boundary is application-enforced and repository-enforced.

## References

- [Architecture Overview](./overview.md)
- [Git Integration Architecture](./git-integration.md)
- [API Overview](../reference/api-overview.md)

# Permissions Model

Use this page when you need the high-level rules behind authorization in OriCMS.

## One Permission System

OriCMS uses one role-based permission model for both people and agents.

Shared roles:

- `owner`
- `admin`
- `editor`
- `viewer`

Humans and agents authenticate differently, but they do not use different underlying permission systems:

- humans authenticate with user sessions
- agents authenticate with bearer tokens

## Resources and Actions

At a high level, the permission model is resource/action based.

Resources:

- `schemas`
- `assets`
- `settings`
- `members`
- `agents`
- `contentTypes`
- `collections`

Actions:

- `create`
- `read`
- `update`
- `delete`
- `publish`

## Effective Role Model

### Owner

Owners have full project control, including:

- project administration
- member and agent management
- settings and delivery configuration
- content and schema control

### Admin

Admins have broad operational control without being the owner.

Typical capabilities:

- manage members and agents
- manage settings
- manage content and schemas

### Editor

Editors are content-focused contributors.

Typical capabilities:

- create and update entries
- publish collection entries
- create and update assets
- participate in publishing workflows where allowed

Current non-capabilities:

- schema and content-type administration
- member and agent administration
- project settings management
- asset deletion

### Viewer

Viewers are the narrowest baseline role.

Do not describe `viewer` as broad read-only project access without checking the current matrix. In the current shared contract, `viewer` is primarily guaranteed asset read access and does not automatically imply general collection or settings visibility.

## Where Permissions Are Enforced

Permissions are enforced in:

- API middleware
- web app action visibility
- agent gateway endpoints

The intent is that the UI and API follow the same authorization model instead of drifting into separate systems.

## Agents and Permissions

Agents use the same project roles as humans.

Additional agent-side constraints can narrow behavior further:

- allowed branches
- allowed collections
- collection write policy

Those are operational constraints, not a separate permission system.

## Publish Semantics

`publish` is a first-class action in the permission model.

That matters for:

- workflow transitions
- delivery-facing content changes
- agent transition endpoints

## Recommended Product Posture

- use the smallest role that still lets the principal do the work
- treat `admin` and `owner` as operational roles, not routine author roles
- use project-level agent config to narrow scope when needed
- avoid inventing one-off permission systems for specific features

That last point matters. The more exceptions a product invents, the less predictable authorization becomes.

## References

- [workflow-model.md](./workflow-model.md)
- [../guides/members-and-agents.md](../guides/members-and-agents.md)
- [../agents/overview.md](../agents/overview.md)
- [../reference/permissions-matrix.md](../reference/permissions-matrix.md)

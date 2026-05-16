# Members and Agents

Use this guide when you are deciding who should have access to a project and how much access they should get.

## One Membership Model

OriCMS uses one project membership model for both people and agents.

That matters because it keeps access control understandable. Agents are not a separate permission universe with their own rules. They use the same project roles as everyone else:

- `owner`
- `admin`
- `editor`
- `viewer`

The difference is how they authenticate, not how authorization works:

- humans use user sessions
- agents use bearer tokens

## Human Members

Add people from the **Members** area when they need to work directly in the project.

Pick the smallest role that still lets them do their job:

- `owner`: full control, including project-level administration
- `admin`: broad operational control without being the owner
- `editor`: entry publishing plus asset creation and updates, without settings/member/schema control
- `viewer`: the narrowest role; do not assume broad read-only workspace access without checking the current permission matrix

## AI Agents

Agents are created from the same **Members** surface. In practice, that means:

- each agent is backed by a service-account-style user
- the agent gets a project role
- OriCMS generates a token
- the token is shown once at creation time

There is no separate agent tier model anymore, and that is intentional.

## What To Expect After Creation

New agents are created to be usable immediately. The point is to avoid the old “the agent exists, but still cannot do useful work” trap.

In a normal project:

- agent access is enabled for the project
- existing project collections become available to the agent
- viewer agents remain non-mutating, but you should still confirm that the role exposes the read surfaces the integration needs
- editor and admin agents can write immediately

## What An Agent Should Do First

The first call should be:

```text
GET /api/v1/agent/v1/bootstrap
```

That bootstrap response gives the agent the current operating context:

- project and branch context
- role and allowed collections
- workflow rules
- entry identity guidance
- current config version metadata

## Operational Controls

Even though humans and agents share roles, agents still need service-account-style safeguards:

- token expiry
- token revocation
- audit logging
- PII redaction on reads

Those are operational controls, not a second authorization model.

## Recommended Access Pattern

Use `editor` for agents that create, update, or publish entries, and `admin` only when the agent truly needs project-level control. Use `viewer` only when the integration genuinely needs the narrowest non-mutating role and you have confirmed that its required read surfaces are available under the current matrix. Rotate or revoke tokens when the agent no longer needs access.

## Related Docs

- [../agents/overview.md](../agents/overview.md)
- [../agents/authentication.md](../agents/authentication.md)
- [../features/agent-gateway.md](../features/agent-gateway.md)
- [../reference/permissions-matrix.md](../reference/permissions-matrix.md)

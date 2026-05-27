# Agent Authentication

Agents authenticate with bearer tokens created from the project member flow.

That is the first important idea to keep straight: agents are part of the project membership model, not a separate principal type with its own standalone permission system.

## How The Model Works

- agents are project members, not a separate principal type with a separate permission system
- each agent token is linked to an agent member
- the agent inherits its effective access from the project role attached to that member
- tokens can also be constrained by project agent configuration such as allowed branches and allowed collections

## Getting a Token

1. Open the project’s **Members** workspace.
2. Choose **Add AI Agent**.
3. Set:
   - **Agent Name**
   - **Role**: `viewer`, `editor`, or `admin`
   - **Token expires in days**
4. Create the agent and copy the generated token immediately.

OriCMS creates a service-account-style user for the agent automatically. That identity is used for audit history and commit authorship.

Generated agent tokens currently use the `agt_` prefix.

## Using the Token

Send the token in the `Authorization` header:

```http
Authorization: Bearer YOUR_AGENT_TOKEN
```

Example:

```bash
curl -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  https://api.oricms.com/api/v1/agent/v1/status
```

## Recommended First Call

After authentication, call bootstrap first:

```http
GET /api/v1/agent/v1/bootstrap
Authorization: Bearer YOUR_AGENT_TOKEN
```

Bootstrap returns the live project context the agent should rely on:

- project name
- current branch
- project role
- allowed branches
- readable, writable, and publishable collections
- workflow rules
- current config freshness metadata

## Token Lifecycle

Agent tokens use the expiry chosen at creation time. They do not refresh. When one expires, create a new token from the Members UI. Admins can revoke tokens immediately, and expired or revoked tokens return `401`.

## Security Guidance

- store tokens in environment variables or secret stores
- do not commit tokens to source control
- rotate tokens when ownership changes or a leak is suspected
- prefer the lowest project role that still allows the intended work

## Common Failure Modes

| Status | Code | Meaning |
|------|------|------|
| `401` | `INVALID_AGENT_TOKEN` | Token does not exist |
| `401` | `REVOKED_AGENT_TOKEN` | Token was revoked |
| `401` | `EXPIRED_AGENT_TOKEN` | Token expired |
| `401` | `UNLINKED_AGENT_TOKEN` | Token is no longer linked to an active agent member |
| `401` | `AGENT_MEMBER_NOT_FOUND` | Agent member is no longer part of the project |
| `403` | `AGENT_ACCESS_DENIED` | Role or project config does not allow the requested action |

## The Practical Rule

Treat the token as the credential and the project role as the authority model. Everything else the agent experiences, including collection restrictions and mutation guardrails, narrows from there.

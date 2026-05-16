# Authentication Configuration

Use this page when you need to understand which parts of authentication are deployment configuration and which are simply part of the product.

Most teams do not spend much time in authentication configuration day to day, but when they do, it is usually because they are deploying OriCMS, tightening security, or setting up agent access.

## How Authentication Works

OriCMS currently uses:

- JWT access tokens
- database-backed refresh sessions
- replay-aware refresh token families
- project-scoped bearer tokens for agent access

Those are product behaviors. Configuration changes how those behaviors are secured and operated in a given environment.

## What You Usually Configure

Depending on deployment and environment, configuration may include:

- JWT secrets
- deployment URLs and related auth-facing origins
- GitHub OAuth credentials if that sign-in path is enabled
- agent token expiry at token-creation time

## Human and Agent Authentication

Humans and agents do not use the same authentication mechanism.

- Humans authenticate through the standard session flow.
- Agents authenticate with project-scoped bearer tokens.

They do, however, share the same project permission model once authenticated. That distinction is important: separate credentials, shared authorization.

## Use This Page With

- deployment environment variables
- project member and agent setup
- on-prem or self-hosted deployment configuration

## Related Docs

- [../reference/api/auth.md](../reference/api/auth.md)
- [../guides/members-and-agents.md](../guides/members-and-agents.md)

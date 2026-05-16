# Members and Agents

Humans and AI agents are both project members. OriCMS does not maintain two separate permission systems for them.

## What The Feature Does

- humans and agents use the same project roles
- agents authenticate differently, but do not use a separate permission taxonomy
- agent mutations use bootstrap, preflight, idempotency, and confirmation flows

That shared model keeps access understandable while still giving agents the operational controls they need, such as token lifecycle management and safer mutation workflows.

## Related Docs

- [../guides/members-and-agents.md](../guides/members-and-agents.md)
- [../agents/overview.md](../agents/overview.md)
- [../product/permissions-model.md](../product/permissions-model.md)

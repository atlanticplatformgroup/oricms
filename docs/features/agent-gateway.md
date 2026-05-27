# Agent Gateway

The agent gateway is the project-scoped API surface for AI agents.

It exists to let agents read and mutate OriCMS content without bypassing the same governance the product expects for humans.

## What The Feature Includes

The gateway combines several concerns that need to stay together:

- role-based access using the same project roles as human members
- project-level constraints such as allowed branches and allowed collections
- PII redaction and field-level visibility filtering on reads
- audit logging for agent access
- guarded mutation flows for create, update, transition, and delete

That combination is what makes it a product surface rather than just “the normal API, but for bots.”

## How It Behaves

Agents authenticate with bearer tokens created from the Members workflow. Once authenticated, their effective access is determined by:

- the agent member’s project role
- project agent configuration
- collection write policy
- endpoint-level checks

The gateway then adds operational controls on top of that access model:

- bootstrap for live project context
- preflight before mutation
- idempotency for retries
- confirmation for destructive actions
- stale-revision protection
- redaction and audit logging on reads

## Why It Matters

Without these controls, an agent integration quickly turns into one of two bad outcomes:

- a weak read-only demo that cannot do useful work
- an overpowered integration that writes too freely and is hard to trust

The gateway is the middle ground: capable enough to be useful, explicit enough to be governable.

## Related Docs

- [../agents/overview.md](../agents/overview.md)
- [../agents/api-reference.md](../agents/api-reference.md)
- [../guides/agent-mutation-workflow.md](../guides/agent-mutation-workflow.md)

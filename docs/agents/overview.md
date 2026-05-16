# Agent Gateway Overview

The OriCMS Agent API gives AI agents controlled access to project content and structure without inventing a separate permission system for them.

Agents use the same project roles as human members. The difference is how they authenticate and which safeguards the gateway enforces around their reads and writes.

## How Agents Fit the Product

- Agents are added from the **Members** area.
- Each agent is represented as a project member backed by a service-account-style user.
- Access is configured per project.
- Authorization is role-based, not tier-based.

## What the Gateway Adds

The agent gateway is not just “the normal API with bearer tokens.”

It adds:

- project-role enforcement
- PII redaction
- audit logging
- field visibility controls
- preflight validation
- idempotent mutations
- delete confirmation
- explicit workflow transitions

## Typical Agent Flow

1. An admin opens **Members** for a project.
2. They create an AI agent and assign a project role.
3. OriCMS generates a token for that agent.
4. The agent calls `/api/v1/agent/v1/bootstrap`.
5. The agent uses the rest of `/api/v1/agent/v1/*` with `Authorization: Bearer <token>`.

## Main Endpoint Families

- status and bootstrap
- schema and structure reads
- history reads
- collection entry reads and writes
- explicit status transitions
- repository file reads

See [api-reference.md](./api-reference.md) for the concrete route contract.

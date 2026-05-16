# Agent Gateway API

Use this page when you need the route-family view of the agent gateway rather than the step-by-step bearer-token guide.

## Two Surfaces Share One Base

The agent gateway lives under:

```text
/api/v1/agent/v1/*
```

It exposes two distinct surfaces:

- bearer-token agent routes for bootstrap, reads, preflight, and mutation
- JWT-authenticated admin routes for project members who manage agent policy and audit history

## Bearer-Token Agent Surface

Current public agent routes include:

- `GET /bootstrap`
- `GET /status`
- `GET /schemas`
- `GET /schemas/:id`
- `GET /structure`
- `GET /history`
- `GET /collections/:name/entries`
- `GET /collections/:name/entries/:id`
- `GET /files/*`
- `POST /diagnose`
- `POST /preflight`
- `POST /collections/:name/entries`
- `PUT /collections/:name/entries/:id`
- `POST /collections/:name/entries/:id/transition`
- `DELETE /collections/:name/entries/:id`

## Admin Surface

Current admin routes include:

- `GET /admin/config`
- `PUT /admin/config`
- `GET /admin/audit-log`
- `GET /admin/audit-log/summary`
- `GET /admin/audit-log/export`
- `GET /admin/tokens`
- `POST /admin/tokens`
- `POST /admin/tokens/:id/revoke`
- `GET /admin/consent`
- `POST /admin/consent`
- `POST /admin/consent/:id/revoke`

These routes are for owners/admins and other members with `agents:*` permissions. They are not part of the bearer-token runtime contract an external agent should memorize.

## What Matters Most

- mutations support idempotency
- destructive actions can require confirmation
- stale revisions and hard locks can block writes
- admin routes control access policy, issued tokens, consent records, and audit visibility

## Related Docs

- [../../agents/api-reference.md](../../agents/api-reference.md)
- [../locking-and-concurrency.md](../locking-and-concurrency.md)

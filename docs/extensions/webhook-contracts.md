# Webhook Contracts

Use this page to understand the current external event and webhook contract boundary.

## Current Principle

Internal lifecycle events and external webhook/plugin events are related but not identical.

External contracts should be stable semantic events. Internal lifecycle events are allowed to stay more implementation-oriented.

## Current External Consumers

The main external consumers today are:

- plugin hook receivers
- build/revalidation targets
- repository/provider webhook senders

## Stability Rule

If an event or webhook behavior is intended for external consumers, document it here or in the linked signing/operations docs before treating it as stable.

## Related Docs

- [plugin-hook-signing.md](./plugin-hook-signing.md)
- [../reference/webhooks.md](../reference/webhooks.md)

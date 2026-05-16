# Webhooks

Use this page when you need to understand where webhooks sit in the OriCMS architecture.

The implementation lives in `packages/api/src/webhooks`.

## Two Webhook Directions

OriCMS currently uses webhooks in two directions:

- inbound repository/provider webhooks
- outbound build, revalidation, and plugin dispatch webhooks

That split is worth remembering, because inbound and outbound webhook problems look very different in practice.

## Inbound Routes

Current inbound provider routes include:

- generic webhook routes
- GitHub routes
- GitLab routes

These are used to react to repository-side events and keep project state synchronized.

## Outbound Dispatch

Outbound webhook behavior includes:

- build triggers
- revalidation triggers
- plugin hook dispatch
- retry and backoff behavior
- alerting on repeated failures

## Security

Current deployment docs cover:

- allowed host controls
- insecure HTTP policy
- private-network blocking
- DNS-based private resolution blocking
- signing and shared-secret validation where applicable

Provider verification is not identical across every inbound webhook type, so treat GitHub, GitLab, and outbound plugin/environment hooks as related but not interchangeable flows.

## Related Docs

- [builds-and-cdn.md](./builds-and-cdn.md)
- [../configuration/deployment-and-build-hooks.md](../configuration/deployment-and-build-hooks.md)
- [../extensions/plugin-hook-signing.md](../extensions/plugin-hook-signing.md)

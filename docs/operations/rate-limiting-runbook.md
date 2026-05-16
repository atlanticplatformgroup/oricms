# API Rate Limiting Runbook

> **Feature:** API rate limiting and abuse controls
> **Status:** Current

## Overview

This runbook covers the operational contract for the OriCMS API rate-limiting stack.

Use it when you need to:

- confirm that production rate limiting is configured safely
- understand the current route-tier budgets the API is enforcing
- investigate bursts of `429 RATE_LIMITED` responses
- diagnose proxy-identity or Redis-store problems

The current implementation lives in:

- [packages/api/src/rate-limit/index.ts](../../packages/api/src/rate-limit/index.ts)
- [packages/api/src/app.ts](../../packages/api/src/app.ts)

## Production Baseline

The production-safe deployment posture is:

1. run the API with `NODE_ENV=production`
2. set `TRUST_PROXY` intentionally for the ingress path in front of the API
3. back rate-limit counters with Redis through `RATE_LIMIT_REDIS_URL`
4. keep the standardized `RateLimit-*` headers enabled for client-visible behavior
5. treat the configured route tiers as part of the API contract, not incidental middleware

Required environment:

- `TRUST_PROXY`
- `RATE_LIMIT_REDIS_URL`
- optional `RATE_LIMIT_REDIS_PREFIX`

Supporting docs:

- [deployment.md](./deployment.md)
- [environment-variables.md](./environment-variables.md)

## Current Route Tiers

The API currently enforces distinct named policies for:

- auth credential flows
- auth registration and refresh flows
- auth session routes
- core authenticated project and management APIs
- public delivery APIs
- agent APIs
- system status routes
- webhook ingestion

When investigating `429`s, identify the route family first. A problem on one tier should not be assumed to mean all API traffic is being throttled together.

## Startup Signals

On healthy startup, the API should emit structured logs similar to:

- `Rate limit Redis store connected`
- `API rate limiting configured`

The configuration log includes:

- `storeMode`
- `trustProxy`
- the effective per-policy `limit` and `windowMs`

Treat this startup log as the fastest way to confirm what the running process believes its limiter configuration is.

## Ongoing Telemetry

OriCMS does not currently expose a dedicated built-in metrics endpoint for limiter counters. The supported operational telemetry is the API's structured logging.

The main events to watch are:

- `API rate limit exceeded`
- `Rate limit Redis client error`
- `TRUST_PROXY is disabled in production. Configure it if the API is deployed behind a reverse proxy or load balancer.`

Useful fields on `API rate limit exceeded`:

- `policy`
- `requestId`
- `method`
- `path`
- `ip`
- `keyFingerprint`
- `limit`
- `used`
- `remaining`

Recommended alerting/monitoring patterns:

1. alert on sustained spikes in `API rate limit exceeded`, grouped by `policy`
2. alert immediately on `Rate limit Redis client error`
3. watch for unexpected growth in auth-tier and agent-tier throttling separately from general API traffic
4. correlate `requestId` with surrounding request logs when investigating a specific client report

The `keyFingerprint` field is safe for grouping repeated offenders without logging raw tokens or secrets.

## Interpreting 429s

Expected client-facing behavior:

- HTTP status `429`
- the standard OriCMS error envelope with `error.code = RATE_LIMITED`
- standardized `RateLimit-*` headers

A `429` is not automatically an outage. First determine whether the volume reflects:

- expected anti-abuse behavior on a narrow route tier
- an overly aggressive budget for a valid client workflow
- bad client identity derivation causing many callers to collapse onto one key

## Failure Modes

### Redis Misconfiguration or Outage

Symptoms:

- API fails to start in production
- `Rate limit Redis client error` appears repeatedly
- deployment health checks never go green after rollout

Checks:

1. confirm `RATE_LIMIT_REDIS_URL` is set and points at reachable Redis
2. confirm the Redis service/container is healthy
3. confirm the API can resolve the Redis hostname from its runtime network
4. check whether multiple environments are colliding and need separate `RATE_LIMIT_REDIS_PREFIX` values

Expected behavior:

- in production, the API requires Redis-backed rate limiting and should not silently fall back to memory

### Incorrect `TRUST_PROXY`

Symptoms:

- many unrelated clients appear to share one limiter bucket
- the logged `ip` field reflects only the proxy hop or an internal address
- auth or API throttling triggers too quickly under otherwise normal traffic

Checks:

1. inspect the ingress chain in front of the API
2. verify what `X-Forwarded-For` should contain in your deployment
3. set `TRUST_PROXY` to the correct hop count or trusted-proxy rule
4. restart the API and confirm the `API rate limiting configured` log reflects the expected setting

If the API is behind the checked-in web container proxy, the normal baseline is `TRUST_PROXY=1`.

### Overly Aggressive Budgets

Symptoms:

- valid workflows begin returning `429`s after a deployment
- one route family shows high `API rate limit exceeded` volume with otherwise healthy infrastructure

Checks:

1. identify the affected `policy`
2. confirm whether the traffic is expected or abusive
3. compare the configured budget against the real client workflow
4. change the budget intentionally in code and re-run verification before rollout

Do not hot-patch budgets ad hoc in one environment without updating the checked-in limiter policy.

## Investigation Sequence

Use this sequence for rate-limit incidents:

1. confirm whether the issue is isolated to one route tier or broader
2. inspect recent `API rate limit exceeded` logs grouped by `policy`, `path`, and `keyFingerprint`
3. confirm the startup logs for `storeMode`, `trustProxy`, and policy budgets
4. validate Redis health and connectivity if failures look cross-cutting
5. validate `TRUST_PROXY` if many callers appear to collapse onto the same bucket
6. only then decide whether the problem is abusive traffic, config drift, or budget tuning

## Verification Expectations

When changing the limiter stack or its budgets, run the mounted-app verification suite:

- `npm run test -w @ori/api -- rate-limit`
- `npm run type-check -w @ori/api`
- `npm run lint -w @ori/api`

The mounted-app tests are intended to catch:

- route-tier wiring regressions
- `429` response envelope drift
- standardized header drift
- cross-tier isolation mistakes

## Related Docs

- [deployment.md](./deployment.md)
- [environment-variables.md](./environment-variables.md)
- [README.md](./README.md)

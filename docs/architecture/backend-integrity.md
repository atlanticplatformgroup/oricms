# Backend Integrity Rules

## Purpose

The API layer should match the composition quality of the frontend. Routes are adapters. Application services own mutation orchestration. Lifecycle dispatch comes from one layer only.

## Layering

### Routes
Routes may own:
- auth and permission checks
- request validation
- mapping requests into application-service commands
- mapping service results into HTTP responses

Routes must not own:
- lifecycle dispatch
- cross-domain mutation orchestration
- audit orchestration
- plugin hook orchestration

### Application services
Application services own high-level domain mutations such as:
- entry create/update/delete
- schema save/delete
- collection create/update/delete
- agent auto-publish

Application services may own:
- lifecycle dispatch
- audit side effects
- plugin hook side effects
- orchestration across git, Prisma, collection services, and dispatchers

### Low-level infrastructure
Low-level git/file primitives do not emit high-level domain lifecycle events unless they are wrapped by an application service that establishes the domain meaning.

`agent-write` is intentionally treated as lower-level infrastructure for now.

## Lifecycle dispatch rule
Lifecycle events are emitted from application services, not routes.

## Extension bootstrap rule
Backend extension/runtime bootstrap must be explicit and centralized. It must be safe to call more than once in dev/HMR environments.

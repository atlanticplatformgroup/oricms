# Auth API

Use the auth API for human session and token flows.

## Current Surface

- registration
- login and session issuance
- refresh rotation
- logout and session invalidation
- current-user and preference routes
- GitHub OAuth exchange

## Notes

- access tokens are JWTs
- refresh behavior is session-backed and replay-aware

## Related Docs

- [../api-overview.md](../api-overview.md)
- [../../configuration/authentication.md](../../configuration/authentication.md)

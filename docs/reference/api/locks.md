# Locks API

Use the locks API for hard-lock acquisition, renewal, release, and status checks.

## Current Surface

- acquire
- renew
- release
- status

## Notes

- lock scopes are project-aware and branch-aware
- acquire, renew, and release require an authenticated principal with a session id
- pass the session id in `x-ori-session-id`
- renew and release also require the lock token issued at acquisition time
- pass the lock token in `x-ori-lock-token`
- blocked mutations return `RESOURCE_LOCKED`

## Related Docs

- [../locking-and-concurrency.md](../locking-and-concurrency.md)

# Plugin Hook Signing Contract

OriCMS plugin hooks are signed with per-plugin secrets to allow receivers to verify authenticity and reject replay attacks.

## Request Headers

Every outbound plugin hook request includes:

- `X-OriCMS-Hook-Id`: unique UUID for this delivery attempt
- `X-OriCMS-Hook-Timestamp`: unix seconds when signed
- `X-OriCMS-Hook-Nonce`: random nonce value
- `X-OriCMS-Hook-Signature`: `sha256=<hex-hmac>`
- `X-OriCMS-Hook-Secret-Prefix`: non-secret prefix identifying the active secret
- `X-OriCMS-Hook-Replay-Window`: replay window hint in seconds (default `300`)

## Signature Algorithm

1. Build signed string:

`<timestamp>.<nonce>.<raw-json-body>`

2. Compute HMAC SHA-256 using plugin secret as key.

3. Send as:

`X-OriCMS-Hook-Signature: sha256=<hex>`

The receiver must validate against the raw request body bytes/string before JSON mutation.

## Replay Protection Contract

Receivers should:

1. Validate timestamp is within accepted window (`±300s` recommended).
2. Build a replay key from:
   `<secretPrefix>:<hookId>:<nonce>:<timestamp>`
3. Reject if replay key already exists.
4. Store replay key with TTL equal to replay window.

## Receiver Helper (`@oricms/client`)

Use `verifyPluginHookRequest(...)` for validation:

- Signature check
- Timestamp window check
- Nonce replay callbacks

The repository also includes an Express receiver example under `examples/plugin-hook-receiver-express.ts`.

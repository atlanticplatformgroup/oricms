# Examples

This directory is for focused runnable or copyable integration artifacts, not narrative documentation or full application labs.

Use `examples/` for:

- sample code you can run locally
- receiver or integration stubs you can adapt into another project
- concrete reference files that docs can point at directly

Examples should prove the primary integration path without carrying unrelated framework scaffolding. If a workflow needs a full application harness, document that separately and keep the smallest useful reference file here.

Use `docs/` for:

- guides
- tutorials
- architecture explanations
- API/reference material

## Current Examples

### `plugin-hook-receiver-express.ts`

An Express webhook receiver example for plugin hook delivery and signature validation workflows.

Use it when you need a concrete starting point for:

- receiving plugin hook POST requests
- validating incoming hook signatures
- adapting Ori hook payloads into another service

### `nextjs-app-router-entry-page.tsx`

A minimal Next.js App Router page example using `@oricms/nextjs` to read a collections-native OriCMS repo directly.

Use it when you need a concrete starting point for:

- wiring `createNextClient()` into a server component page
- generating static params from an OriCMS collection
- generating page metadata from an OriCMS entry
- rendering a single entry by slug in a repo-local Next.js integration

### `build-webhook-receiver.mjs`

A minimal local HTTP server that acts like a successful build webhook target.

Use it when you need a concrete starting point for:

- testing build webhook delivery from the OriCMS UI
- simulating a successful external build system locally
- debugging build payloads without a real deployment target

## Notes

- Examples are intentionally small and focused.
- If an example needs substantial explanation, keep the explanation in `docs/` and link to the file here.
- Do not treat `examples/` as a dumping ground for outdated app or framework scaffolds.

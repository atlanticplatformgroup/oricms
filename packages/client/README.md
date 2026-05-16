# @oricms/client

TypeScript client helpers for OriCMS collections, plugin webhook verification, and related integration utilities.

## Current Status

This package now follows the project-based OriCMS API surface.

Compatibility note:

- `projectId` is the canonical identifier
- `siteId` is still accepted as a deprecated compatibility shim for older callers

## What It Provides Today

- collection read and write helpers
- schema helper methods
- plugin runtime helper methods
- plugin webhook verification
- revalidation webhook verification

## Example

```ts
import { createClient } from '@oricms/client';

const cms = createClient({
  apiUrl: 'https://cms.example.com',
  projectId: 'my-project-id',
  token: process.env.ORICMS_TOKEN,
  mode: 'management',
});

const posts = await cms.collections.list('blog-posts');
```

## Compatibility Note

Older integration code can still pass `siteId`, but new integrations should use `projectId` and treat `siteId` as legacy compatibility only.

## Source of Truth

For the exact current API surface, inspect:

- `src/index.ts`

For current product docs, prefer the main `/docs` tree.

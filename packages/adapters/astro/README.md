# @oricms/astro

Astro integration for modern OriCMS collections repositories.

## Current Repo Shape

The adapter reads the current OriCMS project format directly:

```text
repo/
├── oricms/
│   └── collections.json
├── schemas/
│   └── types/
│       └── *.json
└── content/
    └── <collection-path>/
        └── *.json
```

Legacy `content/pages` repos are compatibility-only. They are not the primary model.

## Installation

```bash
npm install @oricms/astro
```

## Usage

```ts
import { loadContent, loadPage, loadSchemas } from '@oricms/astro/content';

const entries = await loadContent({
  contentPath: './repo',
  preview: false,
});

const entry = await loadPage('./repo', 'hello-world');
const schemas = await loadSchemas('./repo');
```

`preview: true` includes drafts. Published mode excludes draft entries.

## Integration Guidance

For the current product-level integration path, prefer:

- `/docs/integrations/astro.md`
- `/examples/README.md`

Those docs reflect the current collections-native integration path.

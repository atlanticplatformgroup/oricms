# Astro Integration

Astro is a first-class OriCMS integration for teams that want a mostly static, content-driven frontend.

It is a good fit when you want OriCMS to own the content workflow and Astro to turn that content into a documentation site, marketing site, or other performance-oriented frontend.

## Integration Surface

- package: `@oricms/astro`
- current repo shape support: collections-native OriCMS repos

The Astro adapter reads the current OriCMS project format directly:

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

Legacy `content/pages` content remains a compatibility path only. Collections-native repos are the current model.

## What Works

- reads collections-native repos directly
- preview can include drafts
- published builds include published entries only
- local publish hooks can rebuild Astro targets after OriCMS publishes

## Recommended Setup

1. install `@oricms/astro`
2. point it at the project repository root
3. use preview-aware local development during content work
4. rebuild published output from OriCMS environment hooks

That keeps the split clean: OriCMS owns content state, Astro owns rendering and deployment.

## Verification Checklist

- confirm preview includes drafts
- confirm published builds exclude drafts
- confirm environment hooks rebuild the intended target
- confirm routing is driven by collection-native content, not legacy page assumptions

## Troubleshooting

- if preview does not show drafts, verify preview mode is enabled in the app path that calls the adapter
- if published output shows drafts, verify the published build is not accidentally running in preview mode
- if publish loops fail, verify the environment mapping and local or remote build hook wiring

## Canonical Sources

- adapter package: `packages/adapters/astro`
- example: `examples/plugin-hook-receiver-express.ts`

## Verification Status

This integration has package-level loader tests and collections-native example coverage in the repository.

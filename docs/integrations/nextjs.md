# Next.js Integration

Next.js is a first-class OriCMS integration for teams that want OriCMS-managed content inside a React-based frontend stack.

It is the better fit when the frontend is already leaning toward application behavior, server components, or a broader Next.js deployment model.

## Integration Surface

- package: `@oricms/nextjs`
- current repo shape support: collections-native OriCMS repos

The Next.js adapter reads the current OriCMS project format directly:

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

Legacy `content/pages` repos remain a compatibility path only. Collections-native repos are the current model.

## What Works

- server-side helpers for loading entries and schemas
- preview can include drafts
- published builds include published entries only
- local publish hooks can rebuild static Next.js output after OriCMS publishes

## Recommended Setup

1. install `@oricms/nextjs`
2. point it at the project repository root
3. use preview-aware local development while editing
4. rebuild published output from OriCMS environment hooks

As with Astro, the clean model is the same: OriCMS owns the content state and workflow, while Next.js owns how that state turns into a site or app.

## Verification Checklist

- confirm preview includes drafts
- confirm published builds exclude drafts
- confirm environment hooks rebuild the intended target
- confirm routing is driven by collection-native content, not legacy page assumptions

## Troubleshooting

- if preview does not show drafts, verify preview mode is passed through the adapter call path
- if published output shows drafts, verify the published build is not using preview behavior
- if publish loops fail, verify the environment mapping and build hook wiring

## Canonical Sources

- adapter package: `packages/adapters/nextjs`
- example: `examples/nextjs-app-router-entry-page.tsx`

## Verification Status

This integration has package-level loader tests and collections-native example coverage in the repository.

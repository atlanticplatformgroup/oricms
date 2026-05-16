# Building Adapters

Use this page when changing first-class frontend adapters or adding a new one.

## Current First-Class Adapters

- `packages/adapters/astro`
- `packages/adapters/nextjs`

Examples and package-level tests now provide the local verification reference points for the first-class adapters.

## Current Repo Shape

Adapters should target the modern OriCMS project repo shape:

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

Legacy `content/pages` support is compatibility-only. Do not design new adapter behavior around it.

## Required Behaviors

A first-class adapter should handle:

- collection-native content loading
- schema loading
- preview vs published filtering
- slug-based page lookup from entry content
- type generation if the package promises it

Preview mode should include drafts. Published mode should exclude draft entries.

## Package Structure

The current adapter packages follow the same broad split:

- `src/content.ts`
  - raw content and schema loading
- `src/index.ts`
  - framework-facing helpers and type generation
- `test/content-loader.test.mjs`
  - package-level loader and filtering tests

When adding or changing behavior, keep the low-level loader testable without a running framework app.

## Verification Standard

Package tests are necessary but not sufficient.

For any meaningful adapter change:

1. run the package tests
2. run the adapter package build if applicable
3. verify the integration path end to end with package tests and examples

These checks are the current proof that:

- preview targets can read drafts
- publish targets exclude drafts
- local publish hooks rebuild correctly

## Adding a New Adapter

Before adding a new first-class adapter:

1. make sure the support policy allows it
2. follow the same package shape as Astro and Next.js
3. add package-level loader tests
4. add or update a runnable example when the package surface needs one
5. document the integration path under `docs/integrations`

Do not claim first-class support without all of those pieces.

## Practical Checklist

1. Add or update loader behavior in the adapter package.
2. Keep repo-shape assumptions collections-native.
3. Add package tests for loader and preview filtering.
4. Verify the corresponding example or app path manually.
5. Update the package README.
6. Update the matching docs page under `docs/integrations`.

## Related Docs

- [shared-contracts.md](./shared-contracts.md)
- [../integrations/astro.md](../integrations/astro.md)
- [../integrations/nextjs.md](../integrations/nextjs.md)

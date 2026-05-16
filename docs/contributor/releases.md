# Releases

Use this guide when preparing a release, publishing packages, or validating a release candidate.

## Current Reality

OriCMS is still evolving quickly, so release discipline matters more than ceremony.

The important rule is simple:

- do not treat a build artifact or a package publish as proof that the product is ready

Run the repo verification path first, then validate the release surface that actually changed.

## Release Preparation

Before a release or publish step:

1. confirm the branch contains the intended changes only
2. run the appropriate verification path
3. confirm docs and integration notes match the shipped behavior
4. verify any migrations or environment assumptions

Recommended default:

```bash
npm run verify
```

## Package-Oriented Release Checks

If a change is focused on one published package, also validate that package directly.

Examples:

```bash
npm run build -w @ori/shared
npm run build -w @oricms/cli
npm test -w @oricms/client
```

Adapter work should include adapter-local validation, not just repo-level checks.

## Release Notes Expectations

Release notes should describe:

- what changed
- who it affects
- any migration or behavior changes
- any known limitations that still remain

Do not present aspirational or partially implemented behavior as shipped support.

## Migration-Sensitive Changes

If the change touches Prisma schema or persisted contracts:

- verify the migration path
- verify the generated Prisma client
- confirm docs mention the operational step if contributors or operators need to run it manually

## Integration-Sensitive Changes

If the change affects adapters or frontend publish flows:

- verify the local lab or integration harness if one exists
- verify preview and published behavior separately when those differ
- update integration docs if the contract changed

## Suggested Release Checklist

- [ ] branch contents are intentional
- [ ] verification path completed
- [ ] docs match shipped behavior
- [ ] migrations and env changes are documented
- [ ] integration-specific checks completed where relevant

## Related Docs

- [../developer/local-development.md](../developer/local-development.md)
- [../developer/testing.md](../developer/testing.md)

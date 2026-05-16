# Documentation Truth Audit

This note records the current disposition of the Markdown documentation set after the repo-wide truth audit.

The goal is simple: current product behavior is documented, stale artifacts are removed or isolated, and volatile defensive internals are intentionally left out of public and normal developer docs.

## Outcome Labels

- `keep and correct`
- `rewrite substantially`
- `demote to internal-only`
- `delete`

## Root and Package Docs

### Keep and correct

- `README.md`
- `AGENTS.md`
- `packages/README.md`
- `packages/cli/README.md`
- `packages/client/README.md`
- `packages/adapters/astro/README.md`
- `packages/adapters/nextjs/README.md`
- `examples/README.md`

## Public Product Docs (`docs/`)

### Keep and correct

- `docs/README.md`
- `docs/getting-started/*`
- `docs/guides/*`
- `docs/configuration/*`
- `docs/features/*`
- `docs/agents/*`
- `docs/reference/*`
- `docs/reference/api/*`
- `docs/integrations/*`
- `docs/product/*`
- `docs/extensions/*`
- `docs/operations/*`

### Demote to internal-only

- `docs/contributor/*`
- `docs/developer/*`
- `docs/architecture/*`

These remain useful in the repository, but they are not part of the public docs website model.

### Delete

- `docs/api/authentication.md` — duplicate of the maintained auth docs
- `docs/architecture/finished-clean.md` — internal cleanup note, not product documentation

## Internal-Only Docs

### Keep internal-only

- `docs/contributor/internal/README.md`
- historical changelog artifact removed
- `docs/contributor/internal/documentation-migration-map.md`
- `docs/contributor/internal/ideal-documentation-outline.md`
- `docs/contributor/internal/documentation-truth-audit.md`

These documents are allowed to retain historical planning or migration context as long as they do not compete with the current product docs.

## Boundary Decisions

The audit intentionally leaves these out of public and normal developer docs unless a dedicated internal operator runbook needs them:

- exact rate-limit values
- body-size ceilings
- cache tuning numbers
- GraphQL guard thresholds
- similar anti-abuse or defensive implementation details

Those details may exist in code. They are not automatically part of the supported documentation contract.

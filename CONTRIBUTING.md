# Contributing to OriCMS

## Commit Message Convention

We follow a simplified version of [Conventional Commits](https://www.conventionalcommits.org/) with one hard rule: **write for the person reading `git log` six months from now, not for the audit tracker.**

### Format

```
type(scope): imperative description under 50 chars

Optional body explaining what changed and why. Wrap at 72 chars.
Use the body for context that isn't obvious from the diff.
```

### Types

| Type | Use when |
|------|----------|
| `feat` | New behavior, API, or UI surface |
| `fix` | Bug fix — user-visible broken behavior |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `docs` | Documentation, comments, or README changes |
| `chore` | Build, tooling, dependency updates — no production code change |
| `style` | Formatting, whitespace, semicolons — no logic change |

### Scope

Use the package or subsystem name. Be specific.

- ✅ `fix(api)` `feat(web)` `test(cli)` `refactor(adapters/astro)`
- ❌ `fix` (too vague) `fix(code)` `fix(stuff)`

### Subject Line Rules

1. **Imperative mood** — "add" not "added", "fix" not "fixed"
2. **No period at the end**
3. **No audit codes** — never `P1-SEC-02`, `Round 1`, `verification report`, `remediation`
4. **No PR numbers in the subject** — GitHub adds those automatically in the UI
5. **Describe what, not why the work happened** — the body is for why

### Examples

**Good:**
```
fix(astro): rename err to error in catch block

Missed in the adapter catch-block audit. The variable was renamed
to `error` but one reference still used `err`, causing a TS build
failure.
```

```
perf(web): memoize context providers to reduce re-renders

EditorContext, CollectionManagerContext, and SchemaEditorContext
were re-creating their value objects on every render, causing
unnecessary downstream re-renders in large workspaces.
```

```
test(cli): add command tests for auth, cdn, deploy, init, project, start

Covers the six CLI command modules. Uses vitest + mocked Commander
programs. Does not test actual side effects (network, filesystem).
```

**Bad:**
```
fix: resolve verification issues from Round 1 remediation
```
→ Says nothing about what changed. "Verification" and "Round 1" are
meaningless to someone cloning the repo.

```
fix: address remaining Round 1 issues (P1-SEC-02, P2-PERF-02, P1-TEST-07, P2-TEST-01)
```
→ Audit codes in the subject. Multiple unrelated changes crammed into
one vague message.

```
docs: mark P2-TEST-02, PR #42 complete — remediation plan finished! 🎉
```
→ Not even a code change. If you need to track audit progress, use a
project board or the local remediation plan file. Don't pollute git
history with it.

### Multi-package Changes

If a commit touches multiple packages, either split it or use a generic
scope:

```
fix: add .js extensions to ESM imports in CLI tests
```

Or list the scopes if it's truly cross-cutting:

```
fix(api,web): correct auth middleware token validation
```

### Body Guidelines

- Explain **what** the change does and **why** it was needed
- Reference issues or PRs sparingly — `Closes #123` is fine, but don't
dump audit codes
- If the change is complex, explain the trade-off
- If there's a known follow-up, note it: `TODO: add pagination to
  the remaining list endpoints`

### Breaking Changes

If a commit introduces a breaking change, add a `!` after the type/scope
and explain the migration path in the body:

```
feat(api)!: require projectId in all delivery routes

Previously, delivery routes inferred project from hostname. Now the
projectId must be explicit in the path. Update adapter configs to
include the projectId in the delivery base URL.
```

---

## Pull Requests

- Keep PRs focused on one concern
- Use the PR description to explain the *why*, not just the *what*
- Squash merge (external contributors: via GitHub UI; maintainers: direct push or `git merge --squash`)
- Delete the branch after merge

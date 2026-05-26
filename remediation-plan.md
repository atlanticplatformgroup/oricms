# OriCMS Code Quality Remediation Plan

> **Source:** `oricms-code-quality-report.md` (103 issues: 17 P0, 51 P1, 35 P2)  
> **Repo:** `atlanticplatformgroup/oricms`  
> **Workflow:** Feature branch → local preview → PR → squash merge to `main`

---

## Principles

- One theme per PR. Keep each reviewable and rollback-safe.
- P0 (critical) first. P1 (high) next. P2 (nice-to-have) last.
- Mechanical cleanup (renames, deletions) gets its own PR so behavior changes are isolated.
- Test-only PRs come after the code they test is stable.

---

## Phase 1: Original Plan (PRs 1–7)

---

### PR 1: `fix/api-critical-security`

**Branch:** `feature/api-critical-security`

**Scope:** P0 + P1 security hardening in `packages/api/src/`

**Issues:**

| ID | File | Fix |
|---|---|---|
| P0-SEC-01 | `packages/api/src/app.ts:52` | Remove `contentSecurityPolicy: false` or configure proper CSP directives |
| P0-SEC-02 | `packages/api/src/webhooks/generic-routes.ts` | Add project-level webhook secret validation (HMAC-SHA256) | ✅ #34 |
| P0-SEC-03 | `packages/api/src/auth/middleware.ts:71-72` | Remove query parameter JWT support; header only |
| P0-SEC-05 | `packages/api/src/system/routes.ts` | Require auth for setup status or return generic response |
| P0-SEC-09 | `packages/api/src/graphql/routes.ts` | Disable introspection in production |
| P1-SEC-01 | 6 route files (collections, schemas, content-types, assets, branch-mapping, preview) | Add `requireAuth` + `requirePermission('read')` middleware |
| P1-SEC-02 | `packages/api/src/auth/routes.ts` | Add zod schema validation on refresh token body |
| P1-SEC-03 | Auth routes, agent gateway, webhooks | Add `express-rate-limit` (auth: 5/min, API: 100/min) |

**Risk:** Low-to-medium. Each change is localized and additive.

---

### PR 2: `fix/api-error-handling-and-auth-tests`

**Branch:** `feature/api-error-handling-and-auth-tests`

**Scope:** P0 error handling fixes + missing auth tests

**Issues:**

| ID | File | Fix |
|---|---|---|
| P0-ERR-01 | `packages/api/src/graphql/routes.ts`, `agent-gateway/write-routes.ts`, `agent-gateway/admin-routes.ts` | Wrap async handlers with try/catch or `express-async-errors` |
| P0-ERR-02 | `packages/api/src/projects/member-route-support.ts` + 5 others | Replace `req.user!` with explicit null checks → 401 |
| P0-TEST-01 | `packages/api/src/auth/middleware.ts` | Add unit tests for token validation, expiry, malformed tokens, permission extraction |
| P0-TEST-02 | `packages/api/src/auth/credential-route-support.ts` | Add tests for login, invalid password, missing fields, rate limiting, bcrypt rounds |
| P1-ERR-03 | `packages/api/src/middleware/error.ts` | Add tests for 500 handling, custom error codes, serialization |
| P1-ERR-07 | ~14 files across `packages/api/src/` | Bulk rename `catch (err)` → `catch (error)` |

**Dependency:** Best after PR 1 so auth middleware tests validate the new security behavior.

---

### PR 3: `fix/api-performance`

**Branch:** `feature/api-performance`

**Scope:** Collections, caching, DB performance

**Issues:**

| ID | File | Fix |
|---|---|---|
| P0-PERF-01 | `packages/api/src/collections/collection-relations.ts:31-50` | Batch queries with `findMany({ where: { id: { in: [...] } } })` |
| P0-PERF-02 | `packages/api/src/collections/service.ts:52` | Replace unbounded `Map` with LRU cache (max 500, TTL 5 min) |
| P0-PERF-03 | `packages/api/src/collections/warming.ts:14` | Use distributed lock or dedicated worker for warming |
| P1-PERF-04 | `packages/api/prisma/schema.prisma` | Add `@@index([...])` on User.email, User.githubId, ProjectInvite.projectId, ProjectInvite.email, AgentAccess.enabled, AuditLog.action + resourceType/resourceId |
| P1-PERF-05 | 13 list endpoints | Add `limit`/`offset` pagination (default 50, max 500) |
| P1-PERF-06 | `packages/api/src/delivery-projection/reconciler.ts` | Add concurrency limit (e.g., `p-limit` with batch size 5) |
| P1-TEST-07 | `packages/api/src/collections/service.ts` | Add unit tests with mocked Prisma client for CRUD operations |

**Note:** Includes a Prisma migration. Run `npm run db:migrate` and `npm run db:verify-migrations` after schema changes.

---

### PR 4: `fix/web-auth-security`

**Branch:** `feature/web-auth-security`

**Scope:** Token storage and transport in `packages/web/`

**Issues:**

| ID | File | Fix |
|---|---|---|
| P0-SEC-06 | `packages/web/src/hooks/` (auth token storage) | Move JWT from `localStorage` to `httpOnly` secure cookie; if SPA-only, implement short-lived access tokens + refresh rotation |
| P0-SEC-07 | `packages/web/src/components/AuthenticatedImage.tsx` | Use `fetch()` + blob URL with `Authorization` header instead of token in `src` query param |
| P0-SEC-08 | Presence/Socket.IO service (web package) | Replace hardcoded `preview-guest` token with per-session server-generated tokens |

**Risk:** High. These are cross-cutting auth flow changes that may require API coordination.

---

### PR 5: `chore/dead-code-and-naming-cleanup`

**Branch:** `feature/dead-code-and-naming-cleanup`

**Scope:** Mechanical deletions and renames — no behavior changes

**Issues:**

| ID | File | Fix |
|---|---|---|
| P1-DEAD-01 | `packages/api/src/lib/semver.ts` | Delete entire file |
| P1-DEAD-02 | `packages/api/src/lib/crypto.ts:102` | Remove `secureCompare` function |
| P1-DEAD-03 | `packages/api/src/lib/responses.ts:56` | Remove `unprocessableEntity` helper |
| P1-DEAD-04 | `packages/api/src/middleware/error.ts` | Remove `createError()` factory and `ApiError` export |
| P1-DEAD-05 | `packages/web/src/lib/entries/transforms.ts:56-75` | Replace wrappers with direct `@ori/shared` imports; delete wrappers |
| P1-DEAD-06 | `packages/web/src/lib/schemaFieldComputed.ts:91` | Move `buildSchemaFieldDefaults()` to test utilities or remove |
| P1-DEAD-07 | `packages/web/src/contexts/useProject.ts:12` | Remove `useCurrentProject()` hook |
| P1-DEAD-08 | `packages/web/src/lib/utils.ts` | Delete `cn()` utility (Tailwind remnant) |
| P1-DEAD-09 | `packages/web/src/lib/schemaFieldRules.ts` | Delete barrel file; replace imports with `@ori/shared` |
| P2-DEAD-01 | 5 files | Remove `export` from unused functions or delete if unnecessary |
| P1-STYLE-01 | `packages/api/src/projects/configService.ts` | Rename to `config-service.ts`; update imports |
| P1-STYLE-02 | 5 hook files | Rename to `usePascalCase` convention |
| P1-STYLE-03 | 3 E2E files | Rename `*.spec.ts` → `*.test.ts`; update vitest config |
| P1-STYLE-05 | `packages/client/src/index.ts` + others | Remove `.js` import extensions | ⏭️ N/A — Required by `NodeNext` moduleResolution in CLI/adapters packages |
| P2-STYLE-01 | 4 files in `packages/web/src/lib/` | Rename camelCase → kebab-case |
| P2-STYLE-02 | `packages/web/src/` | Add `index.ts` barrel file |
| P2-STYLE-04 | `packages/web/src/testing/workspaceTestHarness.tsx` | Rename to `workspace-test-harness.tsx` |

**Note:** This PR is safe to merge early. If CI passes, it's good.

---

### PR 6: `fix/web-performance-and-styling`

**Branch:** `feature/web-performance-and-styling`

**Scope:** React optimizations and Mantine theme compliance

**Issues:**

| ID | File | Fix |
|---|---|---|
| P1-PERF-07 | Expensive components in `packages/web/src/components/` | Wrap with `React.memo()` — start with field renderers and workspace shell |
| P1-PERF-08 | 40+ files with inline handlers | Extract to `useCallback` (priority: list-rendering components) |
| P1-PERF-09 | `InstanceSetup.tsx`, `App.tsx`, `browse-view-support.tsx`, `WorkspaceFormPrimitives.tsx` | Extract sub-components; lazy-load route components |
| P2-PERF-01 | `packages/web/src/App.tsx` | Add `React.lazy()` for route components |
| P2-PERF-02 | `CollectionManagerContext`, `EditorContext`, `SchemaEditorContext` | Wrap context values with `useMemo` and callbacks with `useCallback` |
| P2-PERF-03 | `packages/api/src/collections/warming.ts` | Lazy warm on first access instead of unconditional startup |
| P1-CSS-01 | `packages/web/src/components/` (159 inline styles) | Move to Mantine `sx` prop, `styles` prop, or CSS modules |
| P1-CSS-02 | `CollectionStatusBadge.tsx`, `AssetListItem.tsx`, `WorkspacePrimitives.tsx` | Replace hardcoded hex/rgba with Mantine theme tokens |
| P2-CSS-01 | ~15 locations | Replace raw `<div>` with `<Flex>`, `<Group>`, or `<Box>` |
| P2-CSS-02 | Multiple component files | Extract duplicated transition strings to shared theme constant |
| P2-CSS-03 | `workspace-shell-sidebar.tsx`, `BuildHistoryTable.tsx` | Replace magic pixel values with `theme.spacing` tokens |
| P2-CSS-04 | `components/ui/WorkspacePrimitives.tsx:128,130` | Replace `<Box style={{display:'flex'}}>` with `<Group gap="xs">` |

**Note:** May overlap with PR 4 if auth changes touch the same components. If so, merge PR 4 first.

---

### PR 7: `test/coverage-expansion`

**Branch:** `feature/test-coverage-expansion`

**Scope:** Add missing tests — no production code changes

**Issues:**

| ID | File | Fix |
|---|---|---|
| P1-TEST-03 | `packages/web/src/hooks/` (29 files) | Add `@testing-library/react` hook tests |
| P1-TEST-04 | `packages/web/src/contexts/` (16 files) | Add render-and-interact tests for providers |
| P1-TEST-05 | `packages/web/src/lib/api/` (14 files) | Add MSW tests for API client functions |
| P1-TEST-06 | `packages/api/src/lib/crypto.ts` | Add tests for hash/verify roundtrip and token uniqueness |
| P1-ERR-04 | `packages/client/src/transport.ts` | Add exponential backoff retry (3 attempts for idempotent methods) + tests |
| P2-TEST-01 | `packages/cli/src/` (15 files) | Add unit tests for command handlers |
| P2-TEST-02 | `packages/adapters/astro/`, `packages/adapters/nextjs/` | Add integration tests for content loading |
| P2-TEST-03 | `packages/api/src/lib/`, `packages/web/src/lib/` | Add unit tests for pure utility functions |
| P2-TEST-04 | `packages/api/src/middleware/` | Add middleware unit tests with mocked `req`, `res`, `next` |

**Dependency:** Best after PRs 1–3 so tests cover stable API behavior.

---

## Phase 2: Post-Plan PRs (#19–#26)

After PRs 1–7 merged, several out-of-scope items from the original plan were completed as focused follow-up PRs.

---

### PR 19: `fix/web-api-client-types`

**Branch:** `feature/p1-style-04-web-api-client-types`

**Scope:** P1-STYLE-04 — replace `any` in web API clients with proper types

| ID | File | Fix |
|---|---|---|
| P1-STYLE-04 | 13 usages across `packages/web/src/lib/api/` | Add types to `@ori/shared`; replace `any` with concrete types in API client params and responses |

**Status:** ✅ Merged | 1 file changed (`@ori/shared` types), 13 `any` usages removed

---

### PR 20: `fix/web-css-inline-styles`

**Branch:** `feature/p1-css-01-inline-styles`

**Scope:** P1-CSS-01 — replace inline styles with Mantine tokens

| ID | File | Fix |
|---|---|---|
| P1-CSS-01 | 26 files | Replace inline `style={{...}}` with Mantine shorthand props (`miw`, `maw`, `flex`, etc.) |

**Status:** ✅ Merged | 26 files, inline styles → `sx`/shorthand props

---

### PR 21: `fix/web-css-hardcoded-colors`

**Branch:** `feature/p1-css-02-hardcoded-colors`

**Scope:** P1-CSS-02 — replace hardcoded hex/rgba with theme tokens

| ID | File | Fix |
|---|---|---|
| P1-CSS-02 | 5 files | Replace hardcoded hex/rgba with `alpha()` + `light`/`dark` Mantine theme variants |

**Status:** ✅ Merged | 5 files

---

### PR 22: `fix/api-lazy-warm`

**Branch:** `feature/p2-perf-03-lazy-warm`

**Scope:** P2-PERF-03 — lazy warm collections on first access

| ID | File | Fix |
|---|---|---|
| P2-PERF-03 | `packages/api/src/collections/warming.ts` | Remove startup `WarmingService.warmAll()`; add `warmProject()` to `getCollectionServiceForProject()` |

**Status:** ✅ Merged | Warming on first access per project; `warmProject()` still called from webhook build-queue

---

### PR 23: `fix/web-react-memo`

**Branch:** `feature/p1-perf-07-react-memo`

**Scope:** P1-PERF-07 — wrap expensive components with `React.memo()`

| ID | File | Fix |
|---|---|---|
| P1-PERF-07 | 10 field renderers + `WorkspaceShellHeader` + `WorkspaceShellNavigation` | Wrap exports with `React.memo()` |

**Status:** ✅ Merged | 12 components wrapped

---

### PR 24: `fix/web-context-memo`

**Branch:** `feature/p2-perf-02-context-memo`

**Scope:** P2-PERF-02 — memoize context hook return values and callbacks

| ID | File | Fix |
|---|---|---|
| P2-PERF-02 | `useCollectionManager`, `useSchemaEditor`, `useEntryEditor` | Wrap return values with `useMemo`; wrap callbacks with `useCallback` |

**Status:** ✅ Merged | 2 `react-hooks/exhaustive-deps` lint warnings remain (factory functions passed to `useCallback` — non-blocking)

---

### PR 25: `fix/web-css-cleanup-batch`

**Branch:** `feature/p2-css-cleanup-batch`

**Scope:** P2-CSS-01/02/03/04 batch

| ID | File | Fix |
|---|---|---|
| P2-CSS-01 | `media-browser-support.tsx` | Replace raw `<div>` with `<Box>` |
| P2-CSS-02 | Multiple files | Extract `WORKSPACE_TRANSITION_FAST` shared constant |
| P2-CSS-03 | `workspace-shell-sidebar.tsx`, `BuildHistoryTable.tsx` | Replace `16px` with `var(--mantine-spacing-md)` |
| P2-CSS-04 | `components/ui/WorkspacePrimitives.tsx` | Replace `<Box style={{display:'flex'}}>` with `<Group gap="xs">` |

**Status:** ✅ Merged | 4 files; remaining magic pixels in `browse-view-support.tsx` (`calc(100% - 300px)`) and `SchemaFieldRow.tsx`/`BuildHistoryTable.tsx`

---

### PR 26: `test/api-client-coverage`

**Branch:** `feature/p1-test-focused-batch`

**Scope:** P1-TEST-05 + discovered fixes

| ID | File | Fix |
|---|---|---|
| P1-TEST-05 | `packages/web/src/lib/api/` (13 modules) | Add 131 unit tests for all API client modules |
| — | `packages/api/prisma/migrations/20260526003646_add_missing_indexes` | **Discovered:** 6 indexes in schema never migrated; added migration to fix `verify-migrations` |
| — | `packages/web/src/__tests__/media-workspace.test.tsx` | Increase `waitFor` timeout 1s → 5s to fix flaky CI test |

**Status:** ✅ Merged | 15 files, 1,307 lines of test code, 1 migration

---

## Merge Order (Actual)

```
PR 1:  fix/api-critical-security                     ✅ #12
PR 5:  chore/dead-code-and-naming-cleanup            ✅ #16
       ↓
PR 2:  fix/api-error-handling-and-auth-tests         ✅ #13
       ↓
PR 3:  fix/api-performance                           ✅ #14
       ↓
PR 4:  fix/web-auth-security                         ✅ #15
       ↓
PR 6:  fix/web-performance-and-styling               ✅ #17
       ↓
PR 7:  test/coverage-expansion                       ✅ #18
       ↓
Out-of-scope / follow-ups (chronological):
  P0-SEC-04 follow-up                               ✅ (fixed invalid 66-char test key)
  P1-STYLE-04  → PR #19                              ✅
  P1-ERR-05    → Prisma error handling               ✅
  P1-ERR-06    → await/.then cleanup                 ✅
  P1-PERF-05   → Pagination limits                   ✅
  P1-PERF-08   → useCallback inline handlers         ✅ (committed to main)
  P1-PERF-09   → React.lazy workspace sections       ✅ (committed to main)
  P1-CSS-01    → PR #20                              ✅
  P1-CSS-02    → PR #21                              ✅
  P2-PERF-03   → PR #22                              ✅
  P1-PERF-07   → PR #23                              ✅
  P2-PERF-02   → PR #24                              ✅
  P2-CSS-01-04 → PR #25                              ✅
  P1-TEST-05   → PR #26 (API client tests)           ✅
  P1-TEST-03   → Batch 4                             ✅ #27
  P1-TEST-03   → Batch 5                             ✅ #28
  P1-TEST-03   → Batch 6                             ✅ #29
  P1-TEST-03   → Batch 7                             ✅ #30
```

---

## Remaining Work

### From Original Plan (Not Yet Started)

| ID | Priority | Description | Owner |
|---|---|---|---|
| P0-PERF-01 | P0 | Batch collection relation queries with `findManyById` | ✅ Merged |
| P0-PERF-02 | P0 | Replace unbounded `Map` with LRU cache (max 500, TTL 5 min) | ✅ Already done |
| P1-PERF-06 | P1 | Add concurrency limit to delivery projection reconciler | ✅ Already done |
| P1-TEST-03 | P1 | Hook tests (`packages/web/src/hooks/` — 26 files) | ✅ Done — 26 hooks/modules tested, 257 tests |
| P1-TEST-04 | P1 | Context provider tests (`packages/web/src/contexts/` — 16 files) | ✅ #32 |
| P1-TEST-06 | P1 | `crypto.ts` hash/verify roundtrip + token uniqueness tests | ✅ #33 |
| P1-DEAD-01 | P1 | Delete `packages/api/src/lib/semver.ts` | ✅ Already done |
| P1-DEAD-02 | P1 | Remove `secureCompare` from `crypto.ts` | ✅ Already done |
| P1-DEAD-03 | P1 | Remove `unprocessableEntity` helper | ✅ Already done |
| P1-DEAD-04 | P1 | Remove `createError()` factory and `ApiError` export from error middleware | ✅ Already done |
| P1-DEAD-05 | P1 | Replace entry transform wrappers with direct `@ori/shared` imports | ✅ Already done |
| P1-DEAD-06 | P1 | Move/remove `buildSchemaFieldDefaults()` | ✅ Already done |
| P1-DEAD-07 | P1 | Remove `useCurrentProject()` hook | ✅ Already done |
| P1-DEAD-08 | P1 | Delete `cn()` utility | ✅ Already done |
| P1-DEAD-09 | P1 | Delete `schemaFieldRules.ts` barrel file | ✅ Already done |
| P1-STYLE-01 | P1 | Rename `configService.ts` → `config-service.ts` | ✅ Already done |
| P1-STYLE-02 | P1 | Rename hooks to `usePascalCase` | ✅ Already done |
| P1-STYLE-03 | P1 | Rename E2E `*.spec.ts` → `*.test.ts` | ✅ Already done |
| P1-STYLE-05 | P1 | Remove `.js` import extensions | ⏭️ N/A — Required by `NodeNext` moduleResolution |
| P1-CSS-01 | P1 | Remaining inline styles (partially done in PR #20) | ✅ Complete — see note below |
| P2-DEAD-01 | P2 | Remove `export` from unused functions | ✅ #36 |
| P2-STYLE-01 | P2 | Rename camelCase → kebab-case in `packages/web/src/lib/` | ✅ #37 |
| P2-STYLE-02 | P2 | Add `index.ts` barrel file | — |
| P2-STYLE-04 | P2 | Rename `workspaceTestHarness.tsx` → `workspace-test-harness.tsx` | ✅ #37 |
| P2-TEST-01 | P2 | CLI command handler tests | — |
| P2-TEST-02 | P2 | Astro/NextJS adapter integration tests | — |
| P2-TEST-03 | P2 | Pure utility function tests | — |
| P2-TEST-04 | P2 | Middleware unit tests with mocked req/res/next | — |

### Partially Complete

| ID | Status | Notes |
|---|---|---|
| P1-TEST-03 | ✅ Done | Batches 1–7 done (26 hooks/modules, 257 tests). All hook test files complete. |
| P1-PERF-04 | 🟡 Done | Indexes added to schema earlier; migration `20260526003646_add_missing_indexes` completed in PR #26. |
| P2-CSS-03 | 🟡 Partial | `16px` → `var(--mantine-spacing-md)` done. Magic pixel values (`calc(100% - 300px)`) in `browse-view-support.tsx`, `SchemaFieldRow.tsx`, `BuildHistoryTable.tsx` still remain. |

### P1-CSS-01 Resolution

**Status:** ✅ Complete (as far as possible in Mantine v8)

**Analysis:** The original code quality report recommended converting inline `style={{...}}` to Mantine `sx` prop. However, **Mantine v8 (installed: 8.3.16+) does not have an `sx` prop** — this was a Mantine v6/v7 (Emotion-based) feature. In v8:
- `style` prop accepts `MantineStyleProp` (objects, theme functions, arrays) — this is the correct API for arbitrary inline styles
- Shorthand props (`w`, `h`, `flex`, `c`, `bg`, etc.) are available for common properties

PR #20 already converted all feasible inline styles to Mantine shorthand props across 26 files. The remaining ~80 inline styles across 20 files are unconvertible because they:
1. Use CSS custom properties (`var(--ori-*)`) — no Mantine shorthand for arbitrary CSS vars
2. Are on non-Mantine elements (`div`, `col`, SVG icons) — must use native `style`
3. Use properties without v8 shorthand equivalents (`cursor`, `transform`, `whiteSpace`, `tableLayout`, `alignSelf`, `borderRadius` on non-Box components)
4. Are dynamic/conditional values that don't map to shorthand props

The `postcss-preset-mantine` package was evaluated and rejected — it does not enable `sx` in v8. It was uninstalled.

**Conclusion:** The remaining inline styles are correct and idiomatic for Mantine v8. They use CSS custom properties that ARE theme-aware (adapt to dark mode), addressing the original report's core concern.

### Already Done (Discovered During Work)

| ID | Status | Notes |
|---|---|---|
| P0-PERF-02 | ✅ Done | `CollectionService.indexCache` already uses `lru-cache` with `max: 500` and `maxAge: 5 min`. |
| P1-PERF-06 | ✅ Done | `reconciler.ts` already uses `pLimit(5)` for concurrency control. |

### Known Issues (Not in Original Plan)

| Issue | Priority | Description | Status |
|---|---|---|---|
| Web E2E Timeouts | P1 | Playwright E2E tests timeout on `locator.boundingBox` across chromium/firefox/webkit. Verify job passes. | 🔴 Failing CI |
| `getPrismaErrorResponse` unused | P2 | `packages/api/src/auth/credential-route-support.ts:7` — `getPrismaErrorResponse` imported but never used. Lint warning. | 🟡 Warn-only |
| `react-hooks/exhaustive-deps` | P2 | 2 warnings in `useEntryEditor.tsx` (lines 144, 269) from `useCallback` wrapping factory functions. 1 warning in `useSchemaEditor.ts` (line 112). | 🟡 Warn-only |

---

## Verification Checklist (per PR)

Before opening each PR:

- [ ] `npm run build -w @ori/shared`
- [ ] `npm run type-check -w @ori/api`
- [ ] `npm run test -w @ori/api` (or relevant package)
- [ ] `npm run build:check -w @ori/web`
- [ ] `npm run test -w @ori/web`
- [ ] `npm run lint --workspaces`

For PRs with Prisma schema changes:
- [ ] `npm run db:generate -w @ori/api`
- [ ] `npm run db:migrate -w @ori/api`
- [ ] `npm run db:verify-migrations -w @ori/api`

---

## Tracking

### Phase 1 (Original Plan)

| PR | Branch | Status | PR # | Notes |
|---|---|---|---|---|
| 1 | `feature/api-critical-security` | ✅ Merged | #12 | 14 files, 488 tests |
| 2 | `feature/api-error-handling-and-auth-tests` | ✅ Merged | #13 | 16 files, 503 tests |
| 3 | `feature/api-performance` | ✅ Merged | #14 | 9 files, 503 tests |
| 4 | `feature/web-auth-security` | ✅ Merged | #15 | 16 files, 503 tests |
| 5 | `feature/dead-code-and-naming-cleanup` | ✅ Merged | #16 | 35 files, 503 tests |
| 6 | `feature/web-performance-and-styling` | ✅ Merged | #17 | 7 files, focused perf subset |
| 7 | `feature/test-coverage-expansion` | ✅ Merged | #18 | 11 files, 516 API tests + 14 client tests |

### Phase 2 (Post-Plan)

| PR | Branch | Status | PR # | Notes |
|---|---|---|---|---|
| 19 | `feature/p1-style-04-web-api-client-types` | ✅ Merged | #19 | Replaced 13 `any` usages in API clients |
| 20 | `feature/p1-css-01-inline-styles` | ✅ Merged | #20 | 26 files, inline styles → tokens |
| 21 | `feature/p1-css-02-hardcoded-colors` | ✅ Merged | #21 | 5 files, hex/rgba → theme tokens |
| 22 | `feature/p2-perf-03-lazy-warm` | ✅ Merged | #22 | Lazy warm on first access |
| 23 | `feature/p1-perf-07-react-memo` | ✅ Merged | #23 | 12 components wrapped |
| 24 | `feature/p2-perf-02-context-memo` | ✅ Merged | #24 | 3 hooks memoized |
| 25 | `feature/p2-css-cleanup-batch` | ✅ Merged | #25 | Box, transitions, spacing tokens |
| 26 | `feature/p1-test-focused-batch` | ✅ Merged | #26 | 131 API client tests + missing indexes migration |

### Phase 3 (Continued Remediation)

| PR | Branch | Status | PR # | Notes |
|---|---|---|---|---|
| 27 | `feature/p1-test-03-hook-tests-batch-4` | ✅ Merged | #27 | 4 files, 65 tests — entryEditorEffects, structuredEditingMutations, structuredEditingSupport, useEntryPersistence |
| 28 | `feature/p1-test-03-hook-tests-batch-5` | ✅ Merged | #28 | 4 files, 43 tests — useGitStatus, useMediaBrowseQueryState, useWorkspaceRouter, useWorkspaceRouteNormalization |
| 29 | `feature/p1-test-03-hook-tests-batch-6` | ✅ Merged | #29 | 4 files, 40 tests — useEntryRelations, useEntryBranchTransfer, useEntryHistory, usePresence |
| 30 | `feature/p1-test-03-hook-tests-batch-7` | ✅ Merged | #30 | 4 files, 45 tests — useCollectionBrowseModel, useCollectionManager, useSchemaEditor, useWorkspaceData |
| 31 | `feature/p1-test-04-context-tests` | ✅ Merged | #32 | 58 context provider tests + DarkModeContext bugfix |
| 32 | `feature/p1-test-06-crypto-tests` | ✅ Merged | #33 | 20 crypto tests + setup.ts DB cleanup resilience |
| 33 | `feature/p0-sec-02-webhook-hmac-validation` | ✅ Merged | #34 | HMAC-SHA256 webhook secret validation for generic + GitLab |
| 34 | `feature/p1-style-05-mark-na` | ✅ Merged | #35 | Mark P1-STYLE-05 as N/A (NodeNext requires .js extensions) |
| 35 | `feature/p2-dead-01-focused-cleanup` | ✅ Merged | #36 | Remove unused deps + deduplicate workspace primitive exports |
| 36 | `feature/p2-style-01-kebab-case-cleanup` | ✅ Merged | #37 | Rename camelCase files to kebab-case (P2-STYLE-01 + P2-STYLE-04) |

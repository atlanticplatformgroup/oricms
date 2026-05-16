# Initial Product QA Audit

Date: 2026-05-16
Branch: `polish/initial-product-qa-audit`

## Scope

This audit is intentionally read-only. It captures the first polish backlog before changing behavior.

Reviewed areas:

- web UI login / first-run path in a live browser
- web UI workspace and onboarding source
- docs terminology and product-model consistency
- `packages/api`, `packages/web`, and `packages/shared` for stale product-model references
- local setup commands and verification readiness

Product rules used as the audit baseline:

- `project` is the primary tenancy boundary
- Git repositories are the source of truth for collections, schemas, entries, and assets
- collections are the universal content model
- humans and agents share one membership and permission model
- stored workflow values are `draft` and `published`
- the UI label `Ready` maps to stored value `published`
- do not reintroduce `site` as the primary product term, legacy Pages/Singles distinctions, separate human/agent permission systems, or agent access tiers

## Executive summary

The strongest immediate polish opportunity is the first-run product experience. A newly registered user can sign in successfully, receive an empty projects response from the API, and then land on a blank dark loading screen with only a spinner. That is both a UX issue and a product-readiness issue because it blocks a clean first impression.

The second major theme is terminology and model drift. The current project/collection model is documented clearly in the canonical docs and `AGENTS.md`, but older page/site/lab language still appears in selected docs, tests, UI examples, and plugin/preview surfaces. Much of it is compatibility or fixture language, but it should be intentionally labeled, renamed, or isolated so new contributors do not treat it as the current product model.

The third theme is agent-surface alignment. The code mostly avoids a separate agent permission model, which is good, but some route shapes and client calls appear mismatched. Those should be verified early because they can become confusing polish bugs in the Members/Agents area.

## Prioritized backlog

### P0 — Add a real zero-project first-run state

Observed in live browser QA:

- created account: `qa-reviewer@example.com`
- signed in successfully
- `/api/v1/projects` returned `{"success":true,"data":{"projects":[]}}`
- UI showed a blank dark screen with a small spinner and no explanatory copy or action

Relevant code:

- `packages/web/src/App.tsx:165-170`
  - when `!currentProject || isBranchSyncing`, the app renders only a bare loader
- `packages/web/src/contexts/ProjectContext.tsx:67-84`
  - `currentProject` is only selected when `projects.length > 0`
- `packages/web/src/contexts/ProjectContext.tsx:87-100`
  - project loading can complete with an empty project list and no error
- `packages/web/src/AppWrapper.tsx`
  - `InstanceSetup` is tied to instance setup, not the authenticated zero-project state

Why it matters:

A new evaluator reaches a dead-end immediately after registration. This should be the first polish fix.

Recommended implementation:

- add an explicit authenticated empty-project state after projects load
- show a clear “Create your first project” path instead of the workspace spinner
- reuse or split the project-creation step from `InstanceSetup`
- replace the bare loader with the existing `WorkspaceLoadingState` pattern where possible

Suggested branch:

- `polish/zero-project-onboarding`

Suggested verification:

```bash
npm run build -w @ori/shared
npm run build:check -w @ori/web
npm run test -w @ori/web
```

### P0 — Fix local setup docs/scripts around seeding and Docker recovery

Observed during local setup:

- `docker-compose up -d postgres` hit a container-name conflict for `oricms-postgres`
- `npm run db:seed -w @ori/api` failed because `packages/api/src/db/seed.ts` does not exist
- the repo docs and `AGENTS.md` still list `npm run db:seed -w @ori/api` as part of the standard setup path

Relevant files:

- `AGENTS.md:150-158`
- `README.md`
- `docs/developer/local-development.md:28-39`
- `packages/api/package.json:18`

Why it matters:

A fresh-history repo should have a reliable first setup story. Broken setup commands make subsequent QA noisy and reduce confidence.

Recommended implementation:

- either restore a real seed script or remove/replace the `db:seed` step
- document how to recover from an existing/stopped `oricms-postgres` container-name conflict
- verify setup under the intended Node version from `.nvmrc`; this audit shell was on Node v25.9.0, while the repo requires Node >=20 and likely expects the version from `nvm use`

Suggested branch:

- `fix/local-setup-seed-script`

Suggested verification:

```bash
nvm use
npm run build -w @ori/shared
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:verify-migrations -w @ori/api
```

### P1 — Align agent admin routes with permission middleware

Potential issue:

Agent admin routes mount under `/api/v1/agent/v1/admin/*`, but they rely on `requirePermission('agents', ...)`. The permission middleware reads `projectId` from `req.params.projectId || req.projectId`; the admin route shape does not include `:projectId`, and the web client sends `projectId` as query/body.

Relevant code:

- `packages/api/src/agent-gateway/admin-routes.ts:20-60`
- `packages/api/src/permissions/middleware.ts:96-110`
- `packages/web/src/lib/api/agent.ts`

Why it matters:

These routes may return “Project ID required” before the route handler reads the query/body project id. This would make Members/Agents admin polish unreliable.

Recommended implementation:

- prefer project-scoped admin routes, or
- add a small middleware that resolves and validates `projectId` before `requirePermission`, or
- make `requirePermission` consistently support the chosen project-id source

Suggested branch:

- `fix(agent): resolve project id before admin permission checks`

Suggested verification:

```bash
npm run build -w @ori/shared
npm run type-check -w @ori/api
npm run test -w @ori/api
```

### P1 — Reconcile web agent client calls with actual API routes

Potential issue:

The web client references agent write/review endpoints that were not found in API source during the audit.

Examples to verify:

- `/api/v1/projects/:projectId/agent/write-config`
- `/api/v1/projects/:projectId/agent/changes`
- `/api/v1/projects/:projectId/agent/promote`

Relevant code:

- `packages/web/src/lib/api/agent.ts`
- `packages/web/src/hooks/queries/useAgentQueries.ts`
- `packages/api/src/agent-gateway/write-routes.ts`

Why it matters:

Dead client calls create hidden 404s and make the agent governance UI feel unfinished.

Recommended implementation:

- map the web client to the current backend route model, or
- add the missing project-scoped API routes, or
- remove unused client hooks until the UI is ready

Suggested branch:

- `fix(agent): align web client with agent gateway routes`

### P1 — Clean up first-project collection/schema empty states

Potential issue:

After a project exists, a new user may still face passive or confusing empty states.

Relevant code:

- `packages/web/src/components/workspace/CollectionsWorkspace.tsx`
- `packages/web/src/components/workspace/CollectionsShellSection.tsx`
- `packages/web/src/components/workspace/modals/CreateCollectionModal.tsx`
- `packages/web/src/hooks/useWorkspaceData.ts`

UX issues:

- “No collections found” is presented as an alert rather than a guided path
- “New collection” is available in the sidebar, but the main panel does not clearly explain schema -> collection -> entry
- collection creation depends on an existing content type, but the modal does not strongly route users to create a schema first

Recommended implementation:

- replace passive alerts with first-run empty states
- add CTAs for “Create a schema” and “Create a collection”
- disable or redirect collection creation when no content types exist
- consider a guided checklist for fresh projects

Suggested branch:

- `polish(web): guide first project content setup`

### P1 — Label legacy preview/pages compatibility more clearly

Potential issue:

Preview docs and API naming still expose `preview/pages` as a discoverable surface. Some docs label it as legacy, but higher-level references can still make it look current.

Relevant docs/code:

- `docs/reference/content-delivery.md`
- `docs/reference/api/preview.md`
- `packages/api/src/preview/route-support.ts`
- `packages/api/src/preview/routes.ts`
- `packages/api/src/preview/__tests__/routes.test.ts`

Recommended implementation:

- clearly label `preview/pages` as legacy compatibility everywhere it appears
- prefer collection/entry preview examples in current docs
- consider collection-oriented function aliases while preserving compatibility

Suggested branch:

- `docs: clarify legacy preview pages compatibility`

### P1 — Move plugin workflow event naming away from pages

Potential issue:

Shared plugin events still include page-specific workflow naming alongside collection record events.

Relevant code:

- `packages/shared/src/plugin-events.ts`
- `packages/api/src/plugins/__tests__/hook-dispatcher.test.ts`
- `packages/api/src/plugins/__tests__/test-helpers.ts`

Recommended implementation:

- introduce collection-oriented workflow event naming
- keep backward compatibility if external consumers may already rely on `page.workflow.transition`
- update fixtures/tests to use collection-native examples

Suggested branch:

- `refactor(shared): add collection workflow plugin event`

### P2 — Normalize docs language around “site”, “frontend”, and removed labs

Findings:

- “adapter labs” references appear stale and no longer match the current repo shape
- “site” appears in some public guide names and delivery/search docs; some uses are acceptable frontend-output language, but the distinction from OriCMS `project` should be clearer

Relevant docs:

- `docs/configuration/deployment-and-build-hooks.md`
- `docs/configuration/environments-and-branch-mappings.md`
- `docs/guides/building-a-headless-site.md`
- `docs/guides/README.md`
- `docs/reference/graphql-delivery.md`
- `docs/reference/content-delivery.md`

Recommended implementation:

- replace “adapter labs” with current package-level adapter tests/examples terminology
- rename or retitle “Building a Headless Site” to “Building a Headless Frontend” if that better reflects the product language
- keep “site” only where it clearly means the deployed external website, not the OriCMS tenancy unit

Suggested branch:

- `docs: modernize frontend delivery terminology`

### P2 — Update UI copy and examples away from Pages/Singles

Findings:

- `packages/web/src/contexts/I18nContext.tsx` has `editor.backToPages` with value “Back to Singles”
- `packages/web/src/components/auth/PermissionGate.tsx` examples mention `canCreatePages`, `canEditPages`, `NewPageButton`, and `PageActions`
- test fixtures still use “Pages” heavily as a canonical example collection

Recommended implementation:

- rename UI keys and labels to collection/entry terminology
- update PermissionGate examples to current shared permissions such as `canCreateEntries` / `canEditEntries`
- gradually replace canonical test fixture names with neutral collection examples such as Articles, Resources, or Cases

Suggested branch:

- `polish(web): remove legacy pages singles copy`

### P2 — Improve loading and auth-page polish

Findings:

- workspace blocking state uses a bare spinner with no context
- GitHub OAuth button can build a URL with `client_id=undefined` if not configured
- login/register page is functional but visually sparse compared with workspace/onboarding surfaces
- locale label uses `Espanol` instead of `Español`

Relevant code:

- `packages/web/src/App.tsx`
- `packages/web/src/components/ui/WorkspacePrimitives.tsx`
- `packages/web/src/components/auth/LoginPage.tsx`

Recommended implementation:

- use contextual loading copy such as “Loading projects” or “Preparing workspace”
- hide or disable GitHub login when `VITE_GITHUB_CLIENT_ID` is absent
- add OriCMS branding/product context to login/register
- fix the Spanish label accent

Suggested branch:

- `polish(web): improve auth and loading states`

### P3 — Remove prototype language from placeholder workspace sections

Finding:

`PlaceholderWorkspace` uses copy such as “Functional depth is planned in subsequent milestones” and a generic “Open {title}” action.

Relevant code:

- `packages/web/src/components/workspace/PlaceholderWorkspace.tsx`

Recommended implementation:

- hide generic actions unless a real action is wired
- replace internal milestone language with user-facing unavailable/coming-soon copy

Suggested branch:

- `polish(web): refine placeholder workspace copy`

## Suggested implementation order

1. `polish/zero-project-onboarding`
2. `fix/local-setup-seed-script`
3. `polish(web): guide first project content setup`
4. `fix(agent): resolve project id before admin permission checks`
5. `fix(agent): align web client with agent gateway routes`
6. `docs: modernize frontend delivery terminology`
7. `polish(web): remove legacy pages singles copy`
8. `docs: clarify legacy preview pages compatibility`
9. `refactor(shared): add collection workflow plugin event`

## Verification performed for this audit

Commands / checks performed:

```bash
git status --short --branch
git remote -v
git log --oneline --decorate -5
docker-compose up -d postgres
npm run build -w @ori/shared
npm run db:generate -w @ori/api
npm run db:migrate -w @ori/api
npm run db:seed -w @ori/api
```

Results:

- branch created from up-to-date `main`: `polish/initial-product-qa-audit`
- `npm run build -w @ori/shared`: passed
- `npm run db:generate -w @ori/api`: passed
- `npm run db:migrate -w @ori/api`: passed, database already in sync
- `npm run db:seed -w @ori/api`: failed because `packages/api/src/db/seed.ts` is missing
- `docker-compose up -d postgres`: hit existing `oricms-postgres` container-name conflict, but an existing Postgres container was available enough for Prisma migration commands to connect
- browser QA reached `http://localhost:5173`, created/logged in a user, and confirmed the zero-project blank spinner state

No runtime source changes were made as part of this audit.

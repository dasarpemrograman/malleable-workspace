# Design

## Context

See `proposal.md` for the problem and selected scope, and the
`contributor-workflow` delta for observable acceptance criteria.

The app is an npm/Node 24 project with a React client and a single Workers entry
point forwarding to `WORKSPACE.getByName("primary")`. The SQLite Durable Object
owns records, authentication, snapshots and delivery scheduling. Existing tests
exercise these contracts through a separately bundled fixture; they are useful
refactoring gates and must remain independent of production bundles.

The client entry point currently contains transport, reusable controls, schema
editing, connections, recovery and the application shell. The Durable Object
contains storage, authentication, routing, domain mutations and the delivery
alarm. Native `.mjs` tooling already has shared modules and focused fixtures;
converting it wholesale is unnecessary for this change.

Existing specifications already protect local isolation, deployment identity,
provider configuration and credential-separated upstream updates. None requires
modification. The project's OpenSpec context predates those implemented features;
refreshing it during apply must preserve the explicit proposal/apply boundary.

## Goals / Non-Goals

**Goals:** a contributor can locate a small change, see it locally, select useful
checks and submit review evidence without production access. Reduce the two large
files through explicit ownership boundaries and preserve observable contracts.

**Non-Goals:** application redesign, a new routing/state framework, schema or
storage migrations, deployment, global type-system cleanup, organization policy
changes, automatic issue assignment or new package-management infrastructure.

## Decisions

### 1. One contributor entry point with a maintained change map

Add `CONTRIBUTING.md`, linked near the README introduction, and
`docs/architecture.md`. Keep user setup in the README; the contributor guide
links it and explains prerequisites, focused/full checks, browser setup, common
errors, state directories, review and OpenSpec. An architecture table maps common
changes to real modules and corresponding suites. Include HTTP/API and signed
delivery examples by linking the existing integration docs rather than duplicating
their contracts. A short PR template requests problem/result/test evidence and
spec or migration notes only when relevant.

Use `.nvmrc` selecting Node 24, `.editorconfig` for basic file conventions and a
consistent explicit Prettier configuration/ignore scope. Link the user's chosen
Scoped Commits standard and examples (`client: ...`, `workspace: ...`,
`updates: ...`, `ci: ...`, `docs: ...`, `openspec: ...`). Do not introduce required
hooks, a Conventional Commits type taxonomy or commit-history enforcement.

Refresh `openspec/config.yaml` with the implemented stack, published contract
boundaries and planning-only semantics. Preserve applicable artifact rules.
Historical acceptance hashes remain historical evidence after the earlier
history rewrite; do not mass-replace them with assertions of new hosted runs.

**Alternative considered:** moving all operator/user docs into the contributor
guide increases duplication. A devcontainer or mandatory hooks would add another
prerequisite before solving the existing command/documentation gaps.

### 2. Watch client builds beside local Wrangler

Replace the one-shot client build in `npm run dev` with a small native Node
supervisor (`scripts/dev.mjs`) using Vite's build-watch API and a local Wrangler
child. Wait for the first successful client build before starting Wrangler.
Keep `127.0.0.1:8787`, `.wrangler/state`, existing secret loading and one-origin
cookie/API behavior. Wrangler watches backend imports; client saves rebuild
assets, which become visible after refreshing. Hot module replacement is not
promised. Initial build failure remains diagnosable and recoverable by editing.

Handle SIGINT/SIGTERM, watch disposal and unexpected child exits; return failure
when Wrangler cannot bind/start or dies. Do not delete state to recover. Document
port collisions and supported environment overrides; do not create a hidden
second backend or proxy origin. Keep the browser harness on 8788 with its own
disposable directory. Exercise the supported Linux path, document macOS guidance,
and label other platforms unverified until actually checked.

**Alternative considered:** a second Vite dev server plus proxy adds cookie,
origin and asset-routing differences. Build-watch reuses production assets and
the existing Workers runtime with fewer changes.

### 3. Focused tests with explicit prerequisite ownership

Add `test:contracts`, `test:runtime` and `test:operators`, keeping native Node
tests and serial execution where required. Contract checks prepare built assets
and a dry Worker bundle because existing assertions inspect packaging. Runtime
checks prepare the fixture bundle directly; operator checks need only installed
dependencies and temporary Git fixtures. Use explicit suite selection that
includes newly added contributor-tooling tests; do not make focused scripts
depend on an earlier aggregate run.

Keep `npm test` as the complete build/bundle/fixture/all-tests contract so the
guarded deploy wrapper and updater continue validating everything. Extract shared
runtime helpers to `tests/helpers/` and split runtime suites by behavior where it
improves selection; update aggregate discovery to include them without duplicate
execution. New tests cover process lifecycle, artifact preparation or meaningful
failure propagation, not a mirror of script text.

Add `format:check` and `check` (`format:check`, typecheck and `npm test`), with
browser acceptance explicit as `test:browser`. Use matching maintained-file
coverage for formatter checking/fixing: source, scripts, examples, tests, root
configs and current contribution docs/workflows. Exclude generated OpenAPI/types,
dependencies, outputs, secrets, persistence, screenshots, vendored/generated
OpenSpec skills, and historical evidence/archive documents. Format touched
maintained code explicitly during apply so the baseline passes; separate bulk
formatting from behavioral changes for review. Do not add another linter merely
to duplicate the existing strict TypeScript and formatter checks.

**Alternative considered:** making `npm test` include browser downloads or
formatting would unexpectedly change the guarded deployment workload. One giant
command without focused suites preserves today's contributor feedback problem.

### 4. Ordinary PR CI shares commands, not updater privileges

Add `.github/workflows/ci.yml` for `pull_request`, default-branch pushes and a
manual dispatch. Expose stable `core` and `browser` check names, pin external
Actions to reviewed SHAs, use Node 24 and read-only repository access, and disable
persisted checkout credentials. Neither job has production secrets or deployment
commands. Core runs `npm ci`, `npm run check` and strict OpenSpec validation;
browser runs install, local setup, Chromium provisioning and the browser command.
Use isolated writable Wrangler config/log directories and locally generated test
credentials. Upload only selected failure diagnostics with short retention;
exclude `.dev.vars`, persisted databases and arbitrary environment dumps.

For an automation-created PR suppressed by GitHub token policy, offer manual
dispatch from the trusted default-branch workflow with an explicit full candidate
commit SHA. Validate the input and check out that commit with no persisted
credentials; never run it with write access or production secrets. Display the
validated SHA so a maintainer can match results to the PR. A later head change
requires a new run. Such manual evidence does not pretend to satisfy a branch
protection rule requiring a PR-associated check; document the limitation.

Document GitHub's approval behavior for external PRs and recommended required
checks. Do not change branch protection or broaden permissions automatically.
Keep the existing updater's separate prepare/validate/publish architecture intact;
candidate commands are still unprivileged and trusted publication never executes
candidate code. Local fixture review cannot substitute for a recorded real CI
run; if hosted execution is unavailable, acceptance records that limit.

**Alternative considered:** adding checks only to the updater leaves ordinary
contributors without feedback. `pull_request_target` or a write token for
candidate execution would violate the existing trust boundary.

### 5. Extract feature modules while retaining one storage owner

Client: keep `main.tsx` for mounting/style imports, move the application shell to
`App.tsx`, put request/session/schema types and transport in `api.ts`, reusable
dialog/icon/error controls in `components/`, and item editor, schema editor,
connections and recovery in feature modules. Pass explicit typed state/callbacks;
retain current polling, pagination, unsaved drafts, conflict messages, focus and
accessibility. Avoid a new global store or a generic component framework.

Backend: retain the exported `Workspace` class at its current import path as the
Durable Object lifecycle owner. Extract storage/schema initialization to a typed
store module, request/auth helpers to an auth module, grouped API/owner handlers
to route modules and alarm/event work to a delivery module. Helpers receive
narrow typed capabilities; no helper creates a second object, opens an independent
database, or exposes an RPC endpoint. Keep origin/configuration/auth checks
central before dispatch. Move existing transaction bodies as units: event
creation stays atomic with mutations; delivery reservation, lease checks and
completion retain their ordering and transaction boundaries.

Preserve Worker entry/export names, binding, `primary` routing and migration tags
exactly; the existing updater checks those identities lexically as well as at
runtime. Keep domain validation independent of UI/provider tools. Do not create
dependency cycles, a generic dependency-injection container or `utils.ts` holding
unrelated concerns. Keep test-only SQL/alarm helpers in `TestWorkspace`, excluded
from production bundles. Prefer small extraction commits, each with the relevant
existing suite passing, over an all-at-once rewrite or arbitrary line-count limits.

Customization remains source editing at documented seams. Names and UI layout can
change without changing stable IDs or integration semantics. Public API, signing,
scopes, snapshots and data migrations still require explicit contract review.

**Alternative considered:** only adding comments leaves the navigation problem.
Splitting into separate services or replacing the DO class would introduce
storage and deployment risks unrelated to contributor experience.

## Risks / Trade-offs

- Extraction changes async/transaction ordering → move existing behavior first,
  run focused tests per step, then all contract/runtime/operator/browser checks.
- Watchers race with first build or leak processes → gate startup on build
  completion; exercise edit/error/recovery, stop, child failure and port reuse.
- Formatter baseline causes noise → explicit maintained-file scope and a separate
  formatting commit; no formatting of archival evidence or generated skills.
- CI policy differs across forks/bot PRs → stable commands and documented approval
  and dispatch paths; real run evidence must state its trigger, SHA and outcome.
- Smaller files alone do not improve contribution → verify the guide against
  concrete UI/API/delivery change paths, not a file-count target.

## Migration Plan

1. Establish the existing local regression baseline; add guide/toolchain/check
   surfaces and the watch supervisor with isolated development acceptance.
2. Extract client modules, then backend store/auth/routes/deliveries in reviewable
   steps. Add only missing behavioral regression coverage discovered at boundaries.
3. Connect ordinary CI to the documented commands, exercising failure feedback
   and candidate dispatch without production credentials or deployment.
4. Walk the guide from a temporary clean checkout; record tool versions, commands,
   edit feedback, tests, CI trigger/SHA/outcomes and any unverified platforms.
5. No live rollout is needed for contributor-tooling acceptance. Any later owner
   deployment uses the existing guard, retained namespace/configuration and checks.
   No SQL migration or snapshot-format change is introduced; rollback is a reviewed
   source revert. Local user state/keys stay owned by the contributor, and tests
   remove only their own temporary data. Existing snapshot/PITR procedures remain
   the recovery path if unrelated data changes are later proposed.

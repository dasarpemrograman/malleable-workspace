# Proposal

## Why

Contributors can run the app locally, but must infer how to navigate it, choose checks and get changes reviewed. A predictable edit/test/review loop and clearer module boundaries will make small contributions easier without changing the workspace's published contracts.

## What Changes

- Add a contributor entry point, architecture/change map and PR template covering setup, common changes, test selection, OpenSpec usage and Scoped Commits (`scope: description`). Keep the README useful for app users and link contributor instructions prominently.
- Make `npm run dev` rebuild frontend edits automatically while retaining the local Workers runtime, one origin, loopback binding and persistent isolated state.
- Expose focused contract, runtime and operator test commands, a non-mutating formatting check and a documented aggregate check command. Keep `npm test`, deployment validation and browser acceptance compatible.
- Add normal pull-request/default-branch CI with stable check names, pinned Actions and no production credentials. Run the same documented checks for external contributions; distinguish required owner approval from passing checks.
- Split the large client entry point and Durable Object implementation into cohesive modules, preserving storage ownership, transaction boundaries, authentication and inbound/outbound contracts. Document where a contributor should change UI, schemas, API behavior, deliveries and deployment tooling.
- Make the supported Node 24 toolchain easy to select, document browser provisioning and align the obsolete OpenSpec project context with the implemented architecture and planning/apply boundary.

### Confirmed intent and proposed defaults

**Confirmed:** make the codebase contributor-first; use Scoped Commits, as explicitly requested in the preceding work.

**Proposed defaults:** npm and Node 24; Linux GitHub Actions for the initial CI target; existing TypeScript, React, Wrangler, Node tests, Playwright and Prettier; watch-build plus local Wrangler rather than a new development backend. Contributor-visible command/CI behavior belongs to a new capability; app refactoring preserves existing capability requirements.

**Observed:** no `CONTRIBUTING.md`, architecture guide, PR template or ordinary PR CI exists. `npm test` builds and runs every suite; `format` only writes. `npm run dev` builds the client once. `src/client/main.tsx` is 1,557 lines and `src/workspace/workspace.ts` 1,148 lines. The only workflow is the separately trusted upstream updater. Project context still describes the pre-implementation repository.

**Deferred:** new product features, API/schema changes, deployment or production writes, repository permission/branch-protection changes, ownership assignments, license selection, mandatory local hooks, a monorepo, replacement frameworks and a broad rewrite of operator tooling. No unanswered product decision blocks this selected scope. Windows support is documented as unverified until exercised rather than promised by this change.

## Capabilities

### New Capabilities

- `contributor-workflow`: discoverable onboarding, automatic local feedback, focused reproducible checks and safe contribution validation before review.

### Modified Capabilities

None. Existing application, local-storage, deployment and upstream-update requirements remain authoritative. Their tests are compatibility gates for the structural changes.

## Impact

- Contribution documentation, README links, GitHub PR/CI configuration, Node/editor/formatter configuration, package scripts, development/test helpers and OpenSpec project context.
- Client modules under `src/client/`, backend modules under `src/workspace/`, and focused runtime test helpers under `tests/`; retain the public Worker class/export, storage binding, literal `primary` route, migration history and fixture isolation.
- Existing API/OpenAPI, snapshots, authentication, tokens and signed delivery semantics must remain compatible. No data migration or new production dependency/service is planned.
- Acceptance includes a clean-checkout contributor walkthrough, frontend/Worker edit feedback, isolated-state preservation, focused checks, an external-contribution CI run when available, and existing contract/runtime/operator/browser regression checks. Missing hosted CI access must be recorded explicitly.

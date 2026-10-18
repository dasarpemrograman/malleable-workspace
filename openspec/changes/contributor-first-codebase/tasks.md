# Tasks

## 1. Contributor entry point and conventions

- [x] 1.1 Record the existing typecheck, full test and browser baseline with tool versions and temporary writable Wrangler configuration; verify the existing suites pass before structural changes and record any environment failures separately.
- [x] 1.2 Add `CONTRIBUTING.md`, the README entry link and a short PR template covering clean setup, private local sign-in, browser provisioning, focused checks, Scoped Commits and planning/apply boundaries; verify relative links resolve and follow the setup commands in a temporary checkout without Cloudflare credentials.
- [x] 1.3 Add Node 24 selection and editor defaults, and refresh OpenSpec project context while retaining applicable rules; verify the selected Node version agrees with package engines/CI and `openspec context` describes the implemented stack without implying proposal authorization permits application changes.

## 2. Focused checks and formatting feedback

- [x] 2.1 Add independent contract/runtime/operator commands with automatic prerequisite preparation, retaining complete `npm test` and deploy/updater coverage; verify each suite runs from absent build outputs, a failing selected test returns nonzero, and every test is included exactly once in the aggregate.
- [x] 2.2 Extract shared runtime test helpers and organize suites by behavior where needed for focused execution; verify fixture-only RPCs remain excluded from production bundles and all original runtime scenarios still run through the public request boundary.
- [x] 2.3 Add matching explicit formatter fix/check scopes and the aggregate `check` command, documenting their use and applying any baseline formatting separately; verify a malformed maintained file is reported without modification, generated/private/state files are excluded, and `npm run check` propagates format/type/test failures.

## 3. Local edit feedback

- [x] 3.1 Implement the development supervisor using client build-watch plus local Wrangler with startup gated on the first valid build; verify client and Worker edits become observable without command restart at the same loopback origin while authenticated content survives.
- [x] 3.2 Handle compilation recovery, interrupted startup, child failure and signal cleanup; exercise a syntax error then correction, occupied port, unexpected child exit, Ctrl-C and subsequent port reuse, verifying failure status where appropriate and no state deletion.
- [x] 3.3 Update the development/troubleshooting guide with refresh behavior, ports, state ownership and verified platform limits; verify its commands in an isolated checkout and confirm the browser harness still resets only its own test directory on port 8788.

## 4. Cohesive application modules

- [x] 4.1 Extract client transport/types, reusable controls, feature editors/connections/recovery and the application shell from the mount entry point; update the architecture map and verify typecheck plus the full browser journey, including conflict drafts, pagination, desktop/narrow layouts and accessibility.
- [x] 4.2 Extract backend store/initialization and request/authentication helpers while retaining the existing Durable Object export, lifecycle and central authorization gate; document capability ownership and verify missing-key/origin/scopes/revocation, persisted-state and newer-schema refusal runtime scenarios.
- [x] 4.3 Extract grouped API/owner handlers while preserving transaction bodies, validation and error mapping; update the API/schema change map and verify stable-ID mutations, false/zero values, revision conflicts, snapshots, bounded pagination and existing OpenAPI/contract checks.
- [x] 4.4 Extract event/delivery/alarm behavior with typed storage capabilities and preserved reservation/completion transactions; document the outbound-change boundary and verify exact signing bytes, pending-work persistence, duplicate alarms, retry budgets, subscription disable and stale completion handling using existing regressions plus only missing boundary cases.

## 5. Contribution CI and review feedback

- [x] 5.1 Add pinned ordinary PR/default-branch CI with stable core/browser checks using the documented commands and isolated local configuration; verify parsed workflow permissions, credential-free candidate execution and failure artifact allowlisting, then record a real run's source SHA, trigger and both job outcomes when available.
- [x] 5.2 Add trusted manual CI dispatch for an explicit validated candidate SHA, documenting external-PR approval and bot-trigger limitations; verify malformed SHA rejection, the displayed tested SHA, no privileged candidate execution and a real dispatched run without claiming it satisfies a missing PR-associated protection check.
- [x] 5.3 Verify ordinary CI and the upstream updater coexist without changing the updater's immutable artifacts or trusted publication boundary; run operator workflow/publication fixtures and inspect PR/default-branch/manual job results, leaving unavailable hosted acceptance explicitly incomplete rather than substituting YAML inspection.

## 6. Integrated contributor acceptance

- [x] 6.1 Walk the complete contributor guide from a clean temporary checkout: install, setup, edit frontend/backend, recover a build error, run every focused/aggregate/browser check and stop/restart with retained data; record outcomes and cleanup only test-owned files and processes.
- [x] 6.2 Publish sanitized contributor acceptance evidence mapping all new scenarios to commands/tests/CI runs and existing inbound/outbound compatibility checks; verify strict OpenSpec validation, the complete regression suite, unchanged storage identity/migration history and a clean tracked tree, with no production deployment or credentials in evidence.

## Workflow follow-up

- Review the proposal before explicitly starting apply.
- Run OpenSpec verification after implementation; sync the contributor-workflow spec and archive only through the archive workflow.

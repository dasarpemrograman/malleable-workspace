# OpenSpec verification: contributor-first-codebase

Verified on 2026-10-18 (Asia/Jakarta), following the official
`openspec-verify-change` skill. Reviewed source:
`a5eacf4af00edbdab256ef2f0c86380a4256ce94`; schema: `spec-driven`.
This report changes no implementation and does not archive the change.

| Dimension | Result |
| --- | --- |
| Completeness | 18/18 tracked tasks complete; 7/7 requirements implemented |
| Correctness | 7/7 requirement mappings; 17/17 scenarios have implementation and verification evidence |
| Coherence | All five design decisions followed; code patterns consistent |

All seven requirements are ADDED; there are no MODIFIED, REMOVED or RENAMED
entries. All applicable checks ran; none are not verified. Task completion came
from the CLI's aggregated progress/task records and was checked against code and
acceptance evidence, rather than inferred from the `all_done` state alone.

## Checks performed

- Read all context files returned by apply instructions: proposal, delta spec,
  design and tasks. Reviewed the relevant implementation, tests and documentation.
- Fresh `npm run check`: formatting and typecheck passed; client build, Worker
  dry bundle and all 30 contract/runtime/operator tests passed with zero skipped.
- Fresh `npm run test:browser`: one full desktop/narrow/accessibility journey
  passed, including external edits, conflict drafts, pagination and recovery.
- Fresh `npx openspec validate --all --strict`: seven passed, zero failed.
- Confirmed relative links in the contributor guide and architecture map resolve.
- Confirmed runtime, scripts, workflow and package/configuration content matches
  the recorded clean-checkout acceptance source `2292f1b`. Subsequent changes
  affect test isolation, task tracking and acceptance documentation.
- Confirmed Worker entry/routing, Wrangler configuration, deployment guard and
  upstream updater workflow are unchanged from pre-implementation `5896f0e`.
- Re-read GitHub run
  [39122258912](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39122258912):
  exact reviewed source `a5eacf4`, with select/core/browser all successful.

Commands used temporary writable Wrangler configuration/log paths and no
deployment command. Expected error messages inside lifecycle/formatter fixtures
are assertions of failure handling, not failed verification checks.

## Requirement mapping

References are repository-relative locations at the reviewed source.

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Discoverable contribution path | `README.md:8`; `CONTRIBUTING.md:6`, `:32`, `:110`; `scripts/setup-local.mjs:1` | Recorded clean-checkout install/setup/sign-in; guide links resolved; current browser journey |
| Automatic local edit feedback | `scripts/dev.mjs:23`, `:40`, `:66`, `:110`, `:139` | `tests/contributor-tools.test.ts:53`, `:97`, `:187`; recorded actual client/Worker edits, syntax recovery, restarts and process failures |
| Independently runnable validation suites | `scripts/test.mjs:5`, `:31`, `:42`; package test/check commands | Partition test `tests/contributor-tools.test.ts:30`; recorded focused runs without outputs and intentional selected/aggregate failure probes; fresh 30-test aggregate |
| Non-mutating quality feedback | `scripts/format.mjs:4`, `:9`, `:26`; `.prettierignore:1` | `tests/contributor-tools.test.ts:129`; recorded malformed-file probe and unchanged workspace export/key after all checks |
| Safe pull-request validation | `.github/workflows/ci.yml:3`, `:14`, `:22`, `:46`, `:71`; `CONTRIBUTING.md:94` | `tests/contributor-tools.test.ts:152`; actual push/PR/manual runs and malformed-SHA rejection; exact-source final CI success |
| Change navigation and contract preservation | `docs/architecture.md:8`, `:37`; `src/client/main.tsx:1`; `src/workspace/workspace.ts:10`; `src/workspace/routes.ts:36`; `src/workspace/deliveries.ts:75` | Existing contracts/runtime/browser suites; `tests/runtime/deliveries.test.ts:125`; recorded unchanged development snapshot and extracted-body comparison |
| Clear contribution conventions | `CONTRIBUTING.md:74`; `.github/pull_request_template.md:1`; `openspec/config.yaml:3` | Direct inspection of Scoped Commits, PR evidence and proposal/apply instructions; links resolved; strict OpenSpec validation |

## Scenario coverage

| Scenario | Code, test or acceptance evidence |
| --- | --- |
| Start from a clean checkout | `CONTRIBUTING.md:6`, local setup script; clean clone install, private key setup and authenticated local walkthrough in the acceptance record |
| Prerequisite is missing | Node/setup guard `scripts/dev.mjs:135`; browser provisioning/override `CONTRIBUTING.md:45`; concrete troubleshooting at `:110`; nonzero failures preserved |
| Edit frontend or backend code | Client watch gate `scripts/dev.mjs:110`, local Wrangler `:71`; recorded served client edit and Worker API edit, same origin and unchanged snapshot |
| Recover from a compilation error | Error event handling `scripts/dev.mjs:118`; build gate fixture `tests/contributor-tools.test.ts:53`; actual failed edit followed by successfully rebuilt corrected assets |
| Stop or fail the development command | Shutdown/group cleanup `scripts/dev.mjs:40`; interruption/child tests `tests/contributor-tools.test.ts:53`, `:97`; real Vite/Wrangler Ctrl-C test `:187`; actual restart/child-failure/port acceptance |
| Validate one area from a clean checkout | Suite-specific prerequisites `scripts/test.mjs:44`; recorded contract/runtime/operator runs after removing outputs; deliberate selected-test failure returned nonzero |
| Run complete validation | Package aggregate check and `scripts/test.mjs:42`; fresh 30-test aggregate and separate browser check; recorded format/type/test failure propagation |
| Check an incorrectly formatted edit | `scripts/format.mjs:26`; fresh non-mutating formatter probe `tests/contributor-tools.test.ts:129`; explicit fix command documented at `CONTRIBUTING.md:58` |
| Validate with existing local data | Explicit formatter scope and ignores; temporary runtime fixtures and browser persistence; recorded identical export/key after all validation commands |
| Validate an external contribution | Read-only workflow and no persisted credentials `ci.yml:14`, `:54`, `:78`; credential/workflow test `tests/contributor-tools.test.ts:152`; real ordinary branch PR with successful core/browser jobs; external-account fork limit below |
| Repository policy requires approval | Normative outcome is guidance: `CONTRIBUTING.md:99` explains approval and inspection; `:89` and `:106` distinguish absent/pending results and branch-protection requirements |
| Review automation-created updates | `CONTRIBUTING.md:102`; trusted SHA selection `ci.yml:35`; real manual success and malformed-SHA selection failure; existing updater permission/publication fixtures passed |
| Locate a small change | Architecture table `docs/architecture.md:10` maps UI/schema/API/delivery/deployment modules to focused suites; referenced modules and guide links exist |
| Preserve inbound clients across refactoring | Central origin/configuration/principal gate `src/workspace/routes.ts:52`; existing auth/items/scopes/persistence/schema-version runtime tests and packaging/API contracts all passed |
| Preserve outbound connections across refactoring | `src/workspace/deliveries.ts:23`, `:75`, `:178`; signing/budgets/disable runtime coverage and stale-cycle receipt regression `tests/runtime/deliveries.test.ts:125`; unchanged store identity |
| Submit a contribution | Area-based commit examples and PR evidence guidance `CONTRIBUTING.md:74`; PR template; no new mandatory hooks or invented spec requirement for small fixes |
| Plan a contract-changing contribution | `CONTRIBUTING.md:69`, `:90`; updated `openspec/config.yaml:3` describes existing contracts and separate proposal/apply authorization |

## Design and code-pattern review

1. **One contributor entry point and change map:** README links the guide; the
   architecture table names real modules/checks. Node/editor defaults, Scoped
   Commits, concise PR evidence and refreshed OpenSpec context are present.
2. **Watch builds beside local Wrangler:** the first valid build starts one local
   Worker on loopback; refresh reveals client edits. Storage and origin behavior
   remain unchanged. Signal/child cleanup is exercised with real tooling.
3. **Focused checks with prerequisites:** suite discovery partitions recursive
   tests, focused runs own their prerequisites, and the aggregate still validates
   all application/operator tests. Formatter checking and fixing share one scope.
4. **Ordinary CI without updater privileges:** immutable Action pins, read-only
   checkout without persisted credentials, isolated browser setup and selected
   diagnostic artifacts match the design. Trusted manual dispatch identifies a
   full SHA; no branch-protection bypass or production deployment is introduced.
5. **Feature modules with one storage owner:** mounting, transport, controls and
   client features are separated. The existing Durable Object owns one store,
   concurrency barrier and typed service wiring. Auth/routes/delivery helpers use
   explicit typed capabilities, and transaction/event/lease ordering remains
   covered by existing regressions. Domain modules remain independent of UI/tools.

The new `.mjs` entry points follow existing operator-script conventions. React
features, backend modules and behavior-focused runtime suites have clear owners;
type-only dependency references do not create runtime cycles. No new framework,
data migration, integration protocol or production service was introduced.

## Evidence boundaries

The [acceptance narrative](contributor-verification.md) and
[machine-readable record](verification/contributor-first-2026-10-18.json)
preserve the completed independent-checkout, deliberate-failure and hosted CI
observations. Disposable PR #1 was closed unmerged and its branch/test files were
removed; that does not invalidate the preserved runs. This verification reran
local checks and read exact-source CI status; it did not recreate that PR.

Linux is the selected exercised platform. macOS and Windows are explicitly
unverified platforms, not promised acceptance targets. External-account fork
execution and an actual maintainer-approval prompt were not directly exercised;
the applicable permission/command handling and documentation were inspected and
tested, with real ordinary PR execution. The approval scenario asks for correct
guidance, which is present. These are limits of live-environment sampling, not
missing requirement mappings or skipped checks. No hosted app rollout was required
or performed, and production resources were not modified.

## Findings and assessment

- CRITICAL: none.
- WARNING: none.
- SUGGESTION: none.
- Not verified: none of the applicable checks.

All checks passed. Ready for archive.

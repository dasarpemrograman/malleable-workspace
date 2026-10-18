# OpenSpec verification: upstream-deployment-updates

Verified on 2026-10-18 (Asia/Jakarta), using the official
`openspec-verify-change` skill and the `spec-driven` artifacts. Reviewed source:
`05a41c96edc7d53a55ac98f1e4bb246e13711540`. This report adds no implementation
changes and does not archive the change.

| Dimension | Result |
| --- | --- |
| Completeness | 15/15 tracked tasks complete; all 11 requirements implemented |
| Correctness | 11/11 requirement mappings; 25/25 scenarios have implementation and verification evidence |
| Coherence | All six design decisions followed; code patterns consistent |

Requirements comprise 10 ADDED and one MODIFIED requirement. There are no
REMOVED or RENAMED entries. All applicable checks ran; none are not verified.
Task completion was read from the CLI's aggregated `progress` and `tasks`, then
cross-checked against implementation and evidence rather than inferred from
checkboxes alone.

## Verification performed

- `npm run typecheck`: passed.
- `npm test`: 23 passed, zero failed or skipped, including client build, Worker
  dry bundle, runtime contracts and all 11 operator tests.
- `npm run test:browser`: one complete journey passed (desktop, narrow widths,
  accessibility, shaping, external updates and recovery).
- `npx openspec validate --all --strict`: six passed, zero failed (this change
  plus the five existing main specs).
- `npm run bundle` with temporary writable Wrangler config/log paths: passed,
  no upload. The first suite invocation completed successfully but Wrangler
  reported that its default log path was read-only; the isolated rerun removed
  that environment issue.
- Read every proposal/design/spec/task context file returned by
  `openspec instructions apply --change upstream-deployment-updates --json`;
  reviewed importer, publisher, deployment wrapper, workflow, tests and guides.
- Compared implementation paths against `12ea0e7`, the upstream target used by
  the successful hosted updater: no differences in `src`, `scripts`, `tests`,
  package/lockfile, Wrangler configuration or `.github` at the reviewed source.

## Requirement mapping

References are repository-relative `file:line` locations at the reviewed source.

| Requirement | Implementation evidence | Verification evidence |
| --- | --- | --- |
| Explicit upstream tracking | `scripts/lib/update-model.mjs:31`; `scripts/lib/git-update.mjs:225` and `:375` | `tests/update-publication.test.ts:142`; `tests/upstream-update.test.ts:204` |
| Bootstrap independent template copies | `scripts/lib/git-update.mjs:125` and `:208`; `scripts/upstream-update.mjs:14` | `tests/upstream-update.test.ts:137`, `:204`, `:244`; real independent-root bootstrap in `docs/update-verification.md:49` |
| Reviewable upstream changes | `scripts/lib/publish-update.mjs:102`, `:143`, `:235`; `.github/workflows/upstream-update.yml:3` | `tests/update-publication.test.ts:80`; recorded PRs #1/#2 and unchanged base before promotion |
| Preserve customizations and expose conflicts | `scripts/lib/git-update.mjs:85`, `:269`, `:294`, `:312` | `tests/upstream-update.test.ts:137` and `:244` |
| Candidate validation and migration disclosure | `.github/workflows/upstream-update.yml:62`; `scripts/lib/git-update.mjs:431`; `scripts/lib/publish-update.mjs:102` | `tests/update-publication.test.ts:80` and `:201`; `tests/deployment-update.test.ts:132`; hosted validation job |
| Separated repository and deployment credentials | `.github/workflows/upstream-update.yml:18`, `:66`, `:84`, `:121`; `scripts/lib/publish-update.mjs:110` | `tests/update-publication.test.ts:201` and `:246`; separate hosted validation job without production credentials |
| Actionable update outcomes | `scripts/deploy.mjs:17`; `scripts/lib/publish-update.mjs:49` and `:102`; `docs/updates.md:187` | `tests/update-publication.test.ts:80`; recorded permission failure, retry, failed build and recovery |
| Safe application upgrades (MODIFIED) | `scripts/lib/deployment.mjs:16` and `:79`; `src/workspace/workspace.ts:63`; `docs/operations.md:74` | `tests/runtime.test.ts:418`, `:482`, `:689`; hosted snapshot, token and pending-delivery retention |
| Explicit upgrade destination | `scripts/lib/deployment.mjs:16`, `:79`, `:221`; `scripts/lib/update-model.mjs:129` | `tests/deployment-update.test.ts:76` and `:132`; `tests/upstream-update.test.ts:244`; hosted namespace identity |
| Retained instance deployment configuration | `scripts/lib/deployment.mjs:79`; `src/workspace/workspace.ts:340`; `src/domain/security.ts` receiver policy | `tests/deployment-update.test.ts:76` and `:132`; `tests/contracts.test.ts:15`; `tests/runtime.test.ts:282`; hosted allowlist/owner-key retention |
| Validated production promotion | `.github/workflows/upstream-update.yml:3`; `scripts/lib/deployment.mjs:36` and `:274`; `docs/updates.md:147` | `tests/deployment-update.test.ts:76` and `:132`; `tests/update-publication.test.ts:201`; actual Workers Builds success/failure/recovery |

## Scenario coverage

Scenario names below exactly match the two delta specs. Fixture verification
includes code inspection of the relevant handling; hosted observations refer to
the preserved acceptance records linked below.

| Scenario | Evidence |
| --- | --- |
| Prepare a pinned update | Moved-ref test, `tests/update-publication.test.ts:142`; hosted PR #2 retained target `12ea0e7` while upstream advanced |
| No new changes | Current/self-update test, `tests/upstream-update.test.ts:204`; recorded canonical Actions no-op |
| Update an old deployed template copy | Unrelated-root fixtures, `tests/upstream-update.test.ts:137` and `:204`; real bootstrap PR #1 |
| Baseline cannot be established | Ambiguous match rejection, `tests/upstream-update.test.ts:244`; unique-match guard, `scripts/lib/git-update.mjs:136` |
| Prepare an update PR | Publication fixture, `tests/update-publication.test.ts:80`; real PRs #1/#2, with PR #2 unmerged and default branch unchanged |
| Repeat an update check | Deduplication fixture, `tests/update-publication.test.ts:80`; real CLI returned PR #1 without rewriting |
| Preserve a customized deployment | Names, independent UI edits, binary files, executable mode, rename/delete assertions, `tests/upstream-update.test.ts:137` |
| Conflicting application edit | Conflicting path and unchanged owner HEAD assertions, `tests/upstream-update.test.ts:244` |
| Upstream history was replaced | Missing baseline and non-ancestral target rejection, `tests/upstream-update.test.ts:244` |
| Candidate fails validation | Failed-result/draft assertions, `tests/update-publication.test.ts:80`; workflow maps actual validation job result to publication |
| Candidate changes migrations | Append-only/additive migration fixtures, `tests/upstream-update.test.ts:101` and `tests/deployment-update.test.ts:132`; summary exposes migration/configuration changes at `scripts/lib/git-update.mjs:431` and `scripts/lib/publish-update.mjs:107` |
| Build an unmerged update | Workflow authority/artifact assertions, `tests/update-publication.test.ts:201`; real unprivileged validation job passed 23 tests and browser journey |
| Merge succeeds but deployment fails | Recorded failing source `0b3d070`, failed build `7a9a3b72-c6fb-493b-aafb-7c8fbca1f755`, unchanged active version; recovery instructions `docs/updates.md:187` |
| GitHub requires workflow approval | Pending-normal-check wording asserted at `tests/update-publication.test.ts:97`; guidance `docs/updates.md:140`; updater and normal PR results remain separate |
| Redeploy an existing workspace | Recorded same namespace/snapshot hash before and after builds; pending delivery retained at attempt one and resumed at attempt two |
| Apply an upstream update to an existing instance | Recorded bootstrap promotion, unchanged IDs/all values/archives, owner access, active token and revoked-token 401 |
| Recover from an incompatible update | Required operator instructions explicitly distinguish code rollback from snapshot/PITR at `docs/updates.md:201` and `docs/operations.md:81`; newer-schema rejection tested at `tests/runtime.test.ts:689` |
| Upstream defaults differ from the deployed name | Name-preserving template test, `tests/upstream-update.test.ts:137`; actual renamed disposable Worker retained its destination |
| Deployment settings disagree | Worker/account/CI override and branch rejection, `tests/deployment-update.test.ts:132` |
| Update would replace storage identity | Removed/deleted migrations, changed binding, wrong namespace and routing rejection, `tests/deployment-update.test.ts:132`; import guard tests `tests/upstream-update.test.ts:244` |
| Preserve dashboard settings during an update | Generated vars omission/keep-vars tests, `tests/deployment-update.test.ts:76`; hosted non-empty allowlist, owner access and signed receiver receipts |
| Deploy a new copy | Credential-free initial provisioning fixture, `tests/deployment-update.test.ts:218`; missing/placeholder owner-key runtime rejection and empty receiver policy in existing contract/runtime tests |
| Review without production effects | No-merge/default-branch assertions, `tests/update-publication.test.ts:80`; preview rejection `tests/deployment-update.test.ts:132`; real PR #2 remained unmerged |
| Deploy a merged update | Recorded merge `91c6f42`, successful build `72faeccd-5a18-40cf-888e-6b70d0120266`, active version `fa650cd7-aef6-4713-bffc-20db816ff4dd`, retained namespace |
| Build fails before upload | Upload callback remains uncalled on failed validation, `tests/deployment-update.test.ts:76`; actual failed Workers Build retained prior active version and UI |

## Design and pattern review

All six decisions are represented: separate import/review/deployment; pinned
three-way delta import; explicit enrollment/bootstrap; candidate validation
without repository-write or deployment authority; guarded destination and
provider-managed configuration retention; and truthful failure/recovery reporting
tested on disposable resources. Only the two name fields and owner metadata are
normalized. Other changes remain reviewable. Publication handles Git objects
without checking out candidate code. Immutable preparer artifact IDs, pinned
Actions, serialized runs and no-force branch publication match the design.

Native `.mjs` operator entry points follow the existing scripts/examples pattern;
shared modules separate validation, Git operations and deployment. New fixtures
use the existing Node test runner and TypeScript app checks. No runtime update
endpoint, new data model or production credential storage was introduced.

## Hosted evidence and scope

The [acceptance narrative](update-verification.md),
[bootstrap record](verification/upstream-updates-2026-10-18.json) and
[hosted record](verification/upstream-updates-hosted-2026-10-18.json) preserve the
first-hand observations from this work. Disposable Workers, namespaces and the
test repository were deleted after acceptance, so their historical URLs need not
resolve now. Verification uses those records and fresh local checks; it does not
claim a fresh hosted deployment occurred during this verify request.

The receiver subscription was paused during the build to preserve its retry
budget, then resumed; the evidence establishes retained/resumed work, not
uninterrupted delivery. Workers Builds status and active Worker versions were
observed independently; restricted Workers CI access prevented reading detailed
remote compiler logs. TS2322 was observed locally. No new SQL migration was
introduced; incompatible recovery is a documentation/guard scenario here, while
the actual hosted recovery exercised compatible code rollback. These evidence
boundaries do not leave an applicable scenario unchecked. Existing `male2` was
not modified, and no hosted writes were performed during this verification.

## Findings and assessment

- CRITICAL: none.
- WARNING: none.
- SUGGESTION: none.
- Not verified: none.

All checks passed. Ready for archive.

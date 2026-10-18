# OpenSpec verification: workspace-mvp

Date: 2026-10-18. Implementation reviewed: commit `0ecb595` (after the
author/committer attribution rewrite; application contents are unchanged).

Result: local checks pass; full change acceptance is incomplete. Do not archive
until the four outstanding live acceptance tasks pass. No application or task
completion changes were made during this verification. OpenSpec tooling was
expanded to all 12 official workflows and its installation made reproducible.

Correction: OpenSpec 1.14.3 includes the official `openspec-verify-change` skill.
The repository was initialized using the `core` profile, whose six generated
workflows omit verify. The earlier assertion that the verify workflow was
unavailable was based on an incomplete search of the generated skill folders.
All 12 workflows are now installed through the official CLI using a custom
profile, via `npm run openspec:init`. The verify skill was read and applied. See
`../.agents/skills/openspec-verify-change/SKILL.md`.

Upstream documentation confirms that verify is an expanded workflow:
https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md#expandedfull-workflow-custom-selection

The official workflow's status and apply-context commands were rerun, and all
planning artifacts are available. OpenSpec artifact status describes planning
completion; it does not establish that implementation acceptance is complete.
The local executable checks below were rerun after installing the complete
workflow set. All 12 skill directories were checked against the bundled workflow
catalog and report generation version 1.14.3. Codex uses skills, so the official
CLI deliberately skips standalone command files.

## Summary scorecard

| Dimension | Status |
| --- | --- |
| Completeness | 28/32 tasks checked; 38 ADDED requirements reviewed; four CRITICAL incomplete tasks. No REMOVED, RENAMED, or MODIFIED requirements. |
| Correctness | Implementation evidence located across all 38 requirements; 58 scenarios inspected. Live behavior and scenario coverage only partially verified. Missing transport, recovery, and browser scenarios are listed below; no blanket correctness pass is claimed. |
| Coherence | Architecture and code-pattern checks performed against the implementation commit; selected architecture followed. Historical proposal wording is a documentation suggestion. |

Partially verified checks: Spec Coverage and Requirement Implementation Mapping
for live deployment/retention/transfer behavior (Cloudflare account unavailable);
Scenario Coverage (live evidence and specific executable cases missing). Task
Completion, Design Adherence, and Code Pattern Consistency were checked from
readable artifacts and the identified implementation; they were not skipped.

## Completeness

The change contains 38 requirements across five capability specifications.
Implementation tasks are 28/32 checked. The following four incomplete tasks are
release acceptance blockers, rather than observed runtime failures:

| Task | Missing evidence | Required action |
| --- | --- | --- |
| 7.2 | Real deploy-button provisioning, hosted owner login/scoped API, and signed public receiver receipt | Exercise the published template in an authorized Cloudflare account. |
| 7.3 | Hosted redeploy/eviction persistence and executed checkpoint recovery | Redeploy the same namespace and verify data, revoked tokens, queued work, budgets, and recovery. |
| 8.1 | Hosted half of the complete customization/API/webhook journey | Run against the deployed HTTPS origin and record actual delivery. |
| 8.2 | Actual local-to-hosted and hosted-to-local snapshot transfers | Restore both directions into pristine targets and verify identities and credential exclusion. |

The last `wrangler whoami` check reported no authenticated account. The public
repository and source-dependent deployment button are available. The owner has
provided the deployed origin https://male2.alfikrona.workers.dev/.
Fresh public HTTPS checks return 200 for the root and JSON 401 with
`Cache-Control: no-store` for session, capabilities, schema, items, connections,
export, and an unknown API route. This establishes deployment reachability and
unauthenticated protection. It does not prove the guided provisioning journey,
owner login, authenticated CRUD, receipt of signed public webhooks, hosted
redeployment/recovery, or actual snapshot transfers. No hosted owner session,
API token, or Cloudflare deployment access is available to this verification.
Synthetic HTTPS tests do not satisfy the remaining live tasks.

## Correctness and traceability

| Specification | Implementation evidence | Executed evidence and limits |
| --- | --- | --- |
| workspace-model | `src/domain/model.ts`; Durable Object initialization, `mutate`, `listItems`, export/restore in `src/workspace/workspace.ts` | Stable IDs, four value kinds, atomic rejection/transaction failure, archival, conflicts, pagination, restart persistence, invalid snapshots and isolated restore pass. Hosted eviction and actual cross-environment transfer remain open. |
| workspace-api | `src/domain/security.ts`; authentication, capabilities, shared operations and owner routes in `src/workspace/workspace.ts`; `docs/openapi.json` | Scopes/revocation, origin/host policy, hosted-origin cookie semantics, key rotation, throttling, byte limits, JSON routing and external client example pass. Hosted-origin cases execute locally. |
| workspace-events | `emit`, `schedule`, `alarm` and owner subscription/delivery routes in `src/workspace/workspace.ts`; receiver verification example | HMAC bytes, family selection, repeated alarm invocation, three-attempt exhaustion, manual retry and disabled-subscription enqueue prevention pass with intercepted networking. Additional edge cases below lack direct tests. |
| workspace-interface | `src/client/main.tsx`, `src/client/style.css` | Browser journey passes schema customization, board movement/renames, 102-item pagination, external refresh, conflict draft preservation, field fallback, token creation, snapshot restoration/export, narrow layout and selected Axe/dialog checks. Not every connection/recovery interaction is covered. |
| workspace-deployment | `src/worker/index.ts`, `wrangler.jsonc`, package scripts, setup script, example secret, README, operations guide | Client build and Worker dry run resolve WORKSPACE/ASSETS; template and secret-boundary assertions pass. Local runtime tests cover network-independent item/schema operations and persisted state reconstruction. Guided provisioning and hosted upgrade/recovery remain open. |

### WARNING: acceptance coverage

1. **Webhook edge cases are implemented but not directly exercised.**
   `tests/runtime.test.ts:482` covers normal retries and repeated sequential alarm
   calls. It does not interrupt an in-flight request and reconstruct the runtime,
   invoke overlapping alarms during a lease, remove an allowlisted host between
   attempts, or return a redirect/timeout from the receiver. URL-policy unit tests
   do not replace these transport/recovery tests. Add controlled runtime cases
   for tasks 2.4 and 4.2–4.3 before treating their full verification clauses as
   proven; assert persisted attempt counts and no prohibited outbound calls.

2. **Browser connection and accessibility coverage is partial.**
   `tests/browser/workspace.spec.ts:221` tests token issuance but does not operate
   webhook subscription creation/disable, failed-delivery retry, or UI token
   revocation. The keyboard check tabs inside an item dialog; it is not a complete
   keyboard-only create/edit journey. Axe covers desktop Connections and the
   narrow workspace, rather than all schema/item/connection forms. Add targeted
   browser cases for the remaining clauses in tasks 5.5–5.6. These gaps do not
   establish that the corresponding controls fail.

The following named spec scenarios require additional evidence. Each has a
corresponding code path, but the indicated condition is not established by the
current tests:

| Scenario | Source / current evidence | Action |
| --- | --- | --- |
| Allowlist changes after subscription creation | `src/workspace/workspace.ts:1083`; initial URL rejection is tested, mid-cycle removal is not | Change allowed hosts between attempts and assert zero receiver requests. |
| Receiver redirects to another service | `src/workspace/workspace.ts:1101`; manual redirect mode exists, transport case absent | Return 302 with Location and assert failure without following it. |
| Restart around receiver acknowledgement | `src/workspace/workspace.ts:1018`; ordinary content restart is tested separately | Interrupt after receipt but before persisted success, reconstruct, and assert stable event identity and consumed attempt budget. |
| Duplicate alarm invocation | `tests/runtime.test.ts:482` checks sequential repetition, not interrupted in-flight recovery | Exercise an in-flight lease and expired lease; assert no fourth automatic request. |
| Configure an external receiver | `src/client/main.tsx:607`; backend subscription tests exist, browser flow absent | Create/disable a subscription through the browser and inspect one-time signing secret and delivery outcomes. |
| Keyboard-only item editing | `tests/browser/workspace.spec.ts:250` checks dialog focus and Escape | Complete create/edit/save using keyboard controls only. |
| Reopen a configured view | `src/client/main.tsx:992`; persistence test creates a view but does not assert reopened browser grouping | Reload/restart a configured board and assert its type/grouping preferences. |
| Hosted object eviction; Fresh-account deployment; Transfer between local and hosted environments; Move a workspace to Workers; Redeploy an existing workspace; Hosted connection instructions | Local simulation/source evidence only | Complete live tasks 7.2, 7.3, 8.1, and 8.2; verify connection examples use the actual deployed origin. |

These are scenario-coverage warnings; the four incomplete task findings remain
the CRITICAL issues. Missing coverage is not evidence of an implementation defect.

## Design coherence

The reviewed implementation follows the selected single Worker/SQLite Durable
Object architecture, fixed `primary` routing, shared validation, stable-ID
contracts, scoped bearer access, alarm-driven outbox, and portable snapshots.
It does not introduce a second backend, remote local bindings, MCP/ACP adapters,
or automatic synchronization.

Documentation suggestion: the opening paragraphs of `design.md`, the introduction
to `tasks.md`, and the workflow follow-up still describe a planning-only checkout
and an unpublished source. They are historical proposal context, but conflict
with the current implementation/publication state. Refresh those statements
when preparing the archive without changing the approved requirements. The current README
and `docs/verification.md` accurately describe the deployment limitation.

## Commands and results

- `npm run typecheck`: passed.
- `npx openspec validate workspace-mvp --strict`: passed.
- Prettier check over source, scripts, examples, tests and project configuration:
  passed.
- `npm test`: passed all 12 tests; includes production client build, Worker
  deployment dry run, and fixture build. No tests skipped.
- `npm run test:browser`: passed 1 browser journey, including its Axe checks.
- Hosted read-only HTTPS checks: root 200; seven protected requests return JSON
  401 with `Cache-Control: no-store`.
- `npx wrangler whoami` in the preceding verification: no authenticated
  Cloudflare account; credentials were not changed during this run.
- `npm run openspec:init`: passed twice; all 12 workflows remain installed.
  Global OpenSpec preferences remain unchanged (`core`, delivery `both`).

Wrangler used metrics disabled and writable temporary configuration storage.
Runtime/browser commands had permission for local network listeners. Receiver
requests in runtime tests were intercepted; no real public webhook receipt is
claimed. The broader original evidence is recorded in `docs/verification.md`.

## Final assessment

Four CRITICAL incomplete-task issues found. Complete tasks 7.2, 7.3, 8.1, and
8.2 before archiving. Scenario-coverage warnings and one documentation suggestion
remain. Spec Coverage, Requirement Implementation Mapping, and Scenario Coverage
are partially verified for the reasons recorded in the scorecard; they are not
counted as fully passing. Verification is advisory and does not modify task
status, implement missing work, or perform archival.

## Requirement implementation mapping

All 38 requirements are ADDED requirements. Evidence below identifies code and
existing tests; it does not count partial/live-only checks as passing. Source
references describe the implementation reviewed at `0ecb595`.

### workspace-api

| Requirement | Implementation | Evidence / limit |
| --- | --- | --- |
| Owner authentication in each environment | `src/domain/security.ts:55; src/workspace/workspace.ts:230–376` | tests/runtime.test.ts:282; hosted unauthenticated requests |
| Scoped external tokens | `src/workspace/workspace.ts:177–184,230–277,802–833` | tests/runtime.test.ts:282,599 |
| Versioned discovery | `src/workspace/workspace.ts:378–389` | Source inspected; no before/after capabilities assertion |
| Schema and item access | `src/workspace/workspace.ts:390–429,460–740` | tests/runtime.test.ts:86,599; tests/browser/workspace.spec.ts:103 |
| Consistent operation semantics | `src/workspace/workspace.ts:421–455,550–740` | tests/runtime.test.ts:86; tests/browser/workspace.spec.ts:164 |
| Bounded requests | `src/domain/model.ts:2–28; src/workspace/workspace.ts:185–229,278–335` | tests/runtime.test.ts:86,282,599 |
| Integration documentation | `docs/openapi.json; docs/api.md; examples/roundtrip.mjs; examples/verify-webhook.mjs` | tests/contracts.test.ts:68,138; tests/runtime.test.ts:750 |

### workspace-deployment

| Requirement | Implementation | Evidence / limit |
| --- | --- | --- |
| Single Workers application | `src/worker/index.ts:1–20; wrangler.jsonc:1–20` | Production build/dry run; local browser; live root/API requests |
| Deploy to Cloudflare entry point | `README.md:30; package.json; wrangler.jsonc; .dev.vars.example` | tests/contracts.test.ts:138; live endpoint exists; provisioning not witnessed |
| Secret-aware startup | `scripts/setup-local.mjs:1–15; src/domain/security.ts:44–51; src/workspace/workspace.ts:336` | tests/contracts.test.ts:15; tests/runtime.test.ts:373; original local startup record |
| Fully local development | `package.json scripts.dev; wrangler.jsonc; src/worker/index.ts:1–20` | tests/runtime.test.ts:716; local Wrangler browser journey |
| Persistent isolated local state | `package.json scripts.dev; .gitignore; src/workspace/workspace.ts:61–112` | tests/runtime.test.ts:418; queued restart/hosted isolation not fully exercised |
| Environment-neutral transfer | `src/domain/model.ts:204–262; src/workspace/workspace.ts:938–1016; docs/operations.md:56` | tests/runtime.test.ts:418; actual two-way hosted transfer not verified |
| Safe application upgrades | `wrangler.jsonc migrations; src/workspace/workspace.ts:61–112; docs/operations.md:74` | tests/runtime.test.ts:689; hosted redeploy/checkpoint recovery not verified |

### workspace-events

| Requirement | Implementation | Evidence / limit |
| --- | --- | --- |
| Durable event envelope | `src/workspace/workspace.ts:550–777` | tests/runtime.test.ts:86,482; interrupted receipt not covered |
| Explicit subscriptions | `src/workspace/workspace.ts:742–776,834–892` | tests/runtime.test.ts:482; queued-disable scenario not asserted |
| Eligible receiver destinations | `src/domain/security.ts:78–116; src/workspace/workspace.ts:1075–1117; wrangler.jsonc` | tests/contracts.test.ts:15; runtime initial rejection; redirect/removal cases absent |
| Verifiable delivery | `src/domain/security.ts:20–37; src/workspace/workspace.ts:1096–1117` | tests/contracts.test.ts:68; tests/runtime.test.ts:482 |
| Bounded retry and durable delivery state | `src/workspace/workspace.ts:777–786,1018–1147` | tests/runtime.test.ts:482; interrupted lease/restart coverage missing |
| Delivery observability and manual retry | `src/workspace/workspace.ts:893–937; src/client/main.tsx:804–867` | tests/runtime.test.ts:482; browser retry flow not covered |
| Non-blocking external delivery | `src/workspace/workspace.ts:742–777,1018–1147` | Failing receiver handled after mutation in tests/runtime.test.ts:482; network-independent operations at :716 |

### workspace-interface

| Requirement | Implementation | Evidence / limit |
| --- | --- | --- |
| Empty starting surface | `src/client/main.tsx:1159–1557` | tests/browser/workspace.spec.ts:12–103 |
| Schema editing through the interface | `src/client/main.tsx:380–600` | tests/browser/workspace.spec.ts:65–98; other-type field exclusion not asserted |
| Item editing and recovery | `src/client/main.tsx:178–376` | tests/browser/workspace.spec.ts:164–186 |
| Search and type filtering | `src/client/main.tsx:1146–1151,1260` | tests/browser/workspace.spec.ts:130,214; combined body/title/type filters not fully asserted |
| Configurable list and board views | `src/client/main.tsx:1137–1158,1320–1480` | tests/browser/workspace.spec.ts:130–213 |
| Saved view preferences | `src/client/main.tsx:992–1021,1062–1080; src/workspace/workspace.ts:794–801` | View writes exist in runtime/browser tests; reopened grouping not asserted |
| Connection management | `src/client/main.tsx:607–881` | tests/browser/workspace.spec.ts:221; backend scopes/subscriptions tested; UI receiver workflow missing |
| Accessible narrow-screen operation | `src/client/main.tsx:94–122; src/client/style.css` | tests/browser/workspace.spec.ts:231–269; complete keyboard-only workflow not covered |
| Owner data recovery controls | `src/client/main.tsx:884–966` | tests/browser/workspace.spec.ts:28–64,270–278 |

### workspace-model

| Requirement | Implementation | Evidence / limit |
| --- | --- | --- |
| Minimal offline workspace | `src/workspace/workspace.ts:61–112; package.json scripts.dev` | tests/runtime.test.ts:86,716 |
| Stable resource identity | `src/domain/model.ts:158–166; src/workspace/workspace.ts:550–740` | tests/runtime.test.ts:86; tests/browser/workspace.spec.ts:139–160 |
| Typed custom values | `src/domain/model.ts:167–203; src/workspace/workspace.ts:648–696` | tests/runtime.test.ts:86; typed values after reconstruction not directly asserted |
| Item lifecycle | `src/workspace/workspace.ts:648–696` | tests/runtime.test.ts:86; archive/restore status and active listing asserted |
| Non-destructive field archival | `src/domain/model.ts:167–203; src/workspace/workspace.ts:582–613` | tests/runtime.test.ts:165; browser grouping fallback/restoration |
| Conflict detection | `src/workspace/workspace.ts:169–176,550–740` | tests/runtime.test.ts:86; tests/browser/workspace.spec.ts:164–186 |
| Durable commits | `src/workspace/workspace.ts:61–112,550–777` | tests/runtime.test.ts:86,418; hosted eviction/event persistence not fully verified |
| Portable export and restoration | `src/domain/model.ts:204–262; src/workspace/workspace.ts:938–1016` | tests/contracts.test.ts:103; tests/runtime.test.ts:418; browser restore; real transfer pending |


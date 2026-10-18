# Verification Report: workspace-mvp

Finalized: 2026-10-18. Reviewed implementation: `ae76115`; application source
is unchanged by this verification. Workflow: official
[openspec-verify-change](../.agents/skills/openspec-verify-change/SKILL.md),
OpenSpec 1.14.3, `spec-driven` schema. All 12 official workflows are installed.

## Summary

| Dimension    | Status                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Completeness | 32/32 tasks complete; implementation evidence located for all 38 ADDED requirements across five capabilities. No MODIFIED, REMOVED or RENAMED requirements.                                                                          |
| Correctness  | All 38 requirements mapped to source; 58 scenarios inspected. Local suite and live acceptance pass. Scenario Coverage is partially verified because the edge cases under W1–W4 lack direct tests; it is not scored as fully passing. |
| Coherence    | Selected architecture and code patterns followed. One suggestion concerning historical proposal wording.                                                                                                                             |

Task Completion, Spec Coverage, Requirement Implementation Mapping, Design
Adherence, and Code Pattern Consistency were evaluated using readable artifacts,
source and tests. No artifact was missing or intentionally skipped. The one
partially verified check is **Scenario Coverage**: specific recovery, transport
and interface variants remain unexercised. No missing implementation or observed
application regression was identified in the checks that ran.

## CRITICAL: none

The four previously open acceptance tasks are now marked complete on evidence:

| Task | Evidence                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.2  | `male2` Cloudflare history identifies `dash_template` deployment and the expected provisioned bindings. Live owner login works. A fresh disposable namespace provisioned without manual database creation, rejected content access before OWNER_KEY configuration, enforced scoped HTTPS API access, and delivered HMAC-signed events to a real public HTTPS receiver. |
| 7.3  | Compatible redeployment retained identity, content, revoked-token state, queued delivery identity and its consumed attempt budget. Delivery resumed and succeeded on slot 2, without resetting total attempts. Explicit object eviction retained content and revocation. A hosted SQLite bookmark restored an acknowledged pre-mutation record exactly.                |
| 8.1  | Local browser/runtime journey plus hosted browser keyboard creation, scoped API read, type/field/option renames through stable IDs, board move, external API edit/UI refresh, real signed receipt, redeployment and object reconstruction.                                                                                                                             |
| 8.2  | A locally exported customized snapshot restored exactly into a pristine hosted instance. Its final hosted export restored exactly into a pristine local instance. Workspace/resource IDs, values, archived text and saved board survived; credentials/subscriptions/history were excluded and destination owner access remained valid.                                 |

See [sanitized live evidence](verification/hosted-2026-10-18.json). The existing
`male2` production app was not redeployed and its content/schema/connections were
not modified. Active testing used `mw-verify-6266adb7` and
`mw-receiver-6266adb7`; both Workers and their Durable Object namespaces were
removed after verification through explicit class-deletion migrations followed
by Worker deletion. No real owner keys, tokens, cookies or OAuth callback codes
appear in the evidence.

## Executed checks

- Local production build, Worker dry run, typecheck, formatting and strict OpenSpec
  validation passed. All 12 runtime/contract tests passed with none skipped.
- The local browser journey passed, including its selected Axe checks, conflict
  draft preservation, 102-item board and snapshot restoration. These recent
  results were retained: production source and existing tests have not changed.
- Original hosted app: root 200; unauthenticated protected routes return JSON 401
  and no-store. Live login, session/capabilities/schema/items/connections reads,
  Secure/HttpOnly/SameSite=Strict cookie, JSON 404 and logout revocation passed.
- Cloudflare OAuth and deployment/version access succeeded. `male2` has ASSETS,
  OWNER_KEY as a secret, WEBHOOK_ALLOWED_HOSTS and WORKSPACE Durable Object binding.
- Disposable live API: read-only scope rejects writes; tool tokens reject owner
  routes; cross-origin mutation rejects with 403; revocation is immediate;
  stale revision rejects with 409. API version remains 1 after schema changes.
- The public receiver stored 16 real receipt bodies. HMAC-SHA256 was recomputed
  over timestamp plus the exact bytes, and matched each received signature.
  Receipts included a hosted UI-created item. Failed HTTP 503 did not block an
  accepted edit; its queued delivery resumed after redeployment.
- Hosted browser: saved board/grouping survives reload, keyboard-only creation is
  visible through the scoped API, resource renames preserve references, board
  move/API update/polling work, connection instructions show the actual HTTPS
  origin, desktop Connections and 360-pixel workspace Axe checks pass.
- PITR/eviction were exercised using an authenticated operator-only harness in
  the disposable namespace. It called `getCurrentBookmark()`, made a mutation,
  called `onNextSessionRestoreBookmark(bookmark)` and aborted the object session;
  the next instance restored the exact original record. The unmodified
  production entry point was redeployed afterward. This is an operator procedure,
  not a recovery/debug endpoint in the shipped application.
- Both transfer directions compared entire supported snapshots for exact equality.
  Local runtime operations used simulated storage and an outbound transport that
  throws on remote fetch; no remote binding or Cloudflare login was needed locally.

### Execution limits

The original dashboard deployment is established by Cloudflare platform history
(`dash_template`) and deployed bindings; this agent did not click through the
original dashboard interaction. A second clean namespace was provisioned with the
same declarations through Wrangler to exercise runtime acceptance.

Chromium initially rejected the managed session proxy certificate. The successful
UI-only run used `ignoreHTTPSErrors` in the disposable browser context; curl-based
API/webhook tests retained normal TLS verification. No production settings or
application TLS behavior were changed. Initial post-secret-deployment 503 cleared
after version propagation; a text locator was corrected in the temporary browser
harness. Neither issue required an application fix.

## WARNING: 4 coverage gaps

These are missing test evidence, not demonstrated defects:

1. **Interrupted receiver acknowledgement and overlapping alarms.**
   `src/workspace/workspace.ts:1018` has durable leases and budgets, and live
   redeployment/PITR/eviction passed. Tests still do not crash specifically after
   receiver acknowledgement but before success persistence, or overlap two
   in-flight alarm calls. Add fault-injection cases in `tests/runtime.test.ts:482`
   asserting stable event bytes, consumed slots and no fourth automatic request.
2. **Transport-policy changes between attempts.**
   `src/workspace/workspace.ts:1083` revalidates destinations and uses manual
   redirects/timeouts. Add controlled transport tests removing an allowed host
   after subscription creation, returning a redirect, and exceeding the timeout;
   assert that prohibited destinations are never contacted. Current URL unit
   tests and successful public receipt do not cover those conditions.
3. **Some connection/interface variants.**
   `tests/browser/workspace.spec.ts:221` and the live browser run cover token
   creation/instructions, boards, keyboard creation and selected accessibility
   screens. Add browser cases for subscription creation/disable, token revocation,
   delivery manual retry, keyboard-only editing and schema/connection dialogs at
   narrow widths. The backend subscription/retry operations are exercised already.
4. **Some validation/filter boundary scenarios.**
   Shared validation and the API/UI operation path are present in
   `src/domain/model.ts:167` and `src/workspace/workspace.ts:550`. Add explicit
   cases for the same invalid select value through both UI/API, fields excluded
   from another type's editor, combined body/title/type filtering, and published
   field/option/snapshot maxima. Existing field-kind, revision, pagination and
   request-byte tests do not establish every boundary in these broad task clauses.

## SUGGESTION: 1 documentation cleanup

The proposal and design retain historical statements that the checkout contains
planning only and public source is unavailable. Add an implementation-status note
before archival so readers recognize those statements as proposal-time context.
Keep the approved architecture and requirements intact.

## Final assessment

No critical issues found in the checks that ran. All 32 task checkboxes now have
implementation/acceptance evidence. Four coverage warnings and one documentation
suggestion remain. **Scenario Coverage is partially verified** for the explicit
edge cases above, so this report does not claim every scenario has passed or give
an unconditional archive-readiness verdict. Verification is finalized; no archive
or spec synchronization was performed.

### Subsequent archive

On 2026-10-18 the owner explicitly requested archival and selected spec sync.
All five main specs were synced, preserving all 38 requirements and 58 scenarios,
then the change moved to
[2026-10-18-workspace-mvp](../openspec/changes/archive/2026-10-18-workspace-mvp/).
All 32 tasks remain complete. The four coverage warnings are retained. The
documentation suggestion above was addressed by adding implementation-status
notes to the archived proposal/design; their original decisions were preserved.

## Requirement implementation mapping

All 38 requirements are ADDED requirements. Evidence below identifies code and
existing tests; it does not count partial/live-only checks as passing. Source
references describe the implementation reviewed at `ae76115`.

### workspace-api

| Requirement                              | Implementation                                                                        | Evidence / limit                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Owner authentication in each environment | `src/domain/security.ts:55; src/workspace/workspace.ts:230–376`                       | tests/runtime.test.ts:282; hosted login, cookie flags, reads, logout and cross-origin rejection pass |
| Scoped external tokens                   | `src/workspace/workspace.ts:177–184,230–277,802–833`                                  | tests/runtime.test.ts:282,599                                                                        |
| Versioned discovery                      | `src/workspace/workspace.ts:378–389`                                                  | Live before/after capabilities preserve API v1 and increase schema revision                          |
| Schema and item access                   | `src/workspace/workspace.ts:390–429,460–740`                                          | tests/runtime.test.ts:86,599; tests/browser/workspace.spec.ts:103                                    |
| Consistent operation semantics           | `src/workspace/workspace.ts:421–455,550–740`                                          | tests/runtime.test.ts:86; tests/browser/workspace.spec.ts:164                                        |
| Bounded requests                         | `src/domain/model.ts:2–28; src/workspace/workspace.ts:185–229,278–335`                | tests/runtime.test.ts:86,282,599                                                                     |
| Integration documentation                | `docs/openapi.json; docs/api.md; examples/roundtrip.mjs; examples/verify-webhook.mjs` | tests/contracts.test.ts:68,138; tests/runtime.test.ts:750                                            |

### workspace-deployment

| Requirement                      | Implementation                                                                               | Evidence / limit                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single Workers application       | `src/worker/index.ts:1–20; wrangler.jsonc:1–20`                                              | Production build/dry run; local browser; live root/API requests                                                                                        |
| Deploy to Cloudflare entry point | `README.md:30; package.json; wrangler.jsonc; .dev.vars.example`                              | tests/contracts.test.ts:138; male2 deployment source is dash_template; real bindings, missing-secret lockout and fresh-namespace provisioning verified |
| Secret-aware startup             | `scripts/setup-local.mjs:1–15; src/domain/security.ts:44–51; src/workspace/workspace.ts:336` | tests/contracts.test.ts:15; tests/runtime.test.ts:373; original local startup record                                                                   |
| Fully local development          | `package.json scripts.dev; wrangler.jsonc; src/worker/index.ts:1–20`                         | tests/runtime.test.ts:716; local Wrangler browser journey                                                                                              |
| Persistent isolated local state  | `package.json scripts.dev; .gitignore; src/workspace/workspace.ts:61–112`                    | tests/runtime.test.ts:418; Live pending delivery survives compatible redeploy; separate local/cloud stores verified                                    |
| Environment-neutral transfer     | `src/domain/model.ts:204–262; src/workspace/workspace.ts:938–1016; docs/operations.md:56`    | tests/runtime.test.ts:418; Exact local-to-hosted and hosted-to-local snapshots verified live                                                           |
| Safe application upgrades        | `wrangler.jsonc migrations; src/workspace/workspace.ts:61–112; docs/operations.md:74`        | tests/runtime.test.ts:689; Live compatible redeploy, explicit object eviction and hosted PITR recovery pass                                            |

### workspace-events

| Requirement                              | Implementation                                                                        | Evidence / limit                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Durable event envelope                   | `src/workspace/workspace.ts:550–777`                                                  | tests/runtime.test.ts:86,482; interrupted receipt not covered                                                |
| Explicit subscriptions                   | `src/workspace/workspace.ts:742–776,834–892`                                          | tests/runtime.test.ts:482; queued-disable scenario not asserted                                              |
| Eligible receiver destinations           | `src/domain/security.ts:78–116; src/workspace/workspace.ts:1075–1117; wrangler.jsonc` | tests/contracts.test.ts:15; runtime initial rejection; redirect/removal cases absent                         |
| Verifiable delivery                      | `src/domain/security.ts:20–37; src/workspace/workspace.ts:1096–1117`                  | tests/contracts.test.ts:68; tests/runtime.test.ts:482                                                        |
| Bounded retry and durable delivery state | `src/workspace/workspace.ts:777–786,1018–1147`                                        | tests/runtime.test.ts:482; interrupted lease/restart coverage missing                                        |
| Delivery observability and manual retry  | `src/workspace/workspace.ts:893–937; src/client/main.tsx:804–867`                     | tests/runtime.test.ts:482; browser retry flow not covered                                                    |
| Non-blocking external delivery           | `src/workspace/workspace.ts:742–777,1018–1147`                                        | Failing receiver handled after mutation in tests/runtime.test.ts:482; network-independent operations at :716 |

### workspace-interface

| Requirement                          | Implementation                                                               | Evidence / limit                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty starting surface               | `src/client/main.tsx:1159–1557`                                              | tests/browser/workspace.spec.ts:12–103                                                                                                                                                   |
| Schema editing through the interface | `src/client/main.tsx:380–600`                                                | tests/browser/workspace.spec.ts:65–98; Type-specific UI implemented; other-type field exclusion not directly asserted                                                                    |
| Item editing and recovery            | `src/client/main.tsx:178–376`                                                | tests/browser/workspace.spec.ts:164–186                                                                                                                                                  |
| Search and type filtering            | `src/client/main.tsx:1146–1151,1260`                                         | tests/browser/workspace.spec.ts:130,214; combined body/title/type filters not fully asserted                                                                                             |
| Configurable list and board views    | `src/client/main.tsx:1137–1158,1320–1480`                                    | tests/browser/workspace.spec.ts:130–213                                                                                                                                                  |
| Saved view preferences               | `src/client/main.tsx:992–1021,1062–1080; src/workspace/workspace.ts:794–801` | Hosted board type/grouping survives browser reload with stable IDs                                                                                                                       |
| Connection management                | `src/client/main.tsx:607–881`                                                | tests/browser/workspace.spec.ts:221; backend scopes/subscriptions tested; Live signed public delivery and API subscription controls pass; browser receiver form coverage remains partial |
| Accessible narrow-screen operation   | `src/client/main.tsx:94–122; src/client/style.css`                           | tests/browser/workspace.spec.ts:231–269; Hosted keyboard-only creation, narrow layout and Axe pass; full keyboard-only edit remains partial                                              |
| Owner data recovery controls         | `src/client/main.tsx:884–966`                                                | tests/browser/workspace.spec.ts:28–64,270–278                                                                                                                                            |

### workspace-model

| Requirement                     | Implementation                                                     | Evidence / limit                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal offline workspace       | `src/workspace/workspace.ts:61–112; package.json scripts.dev`      | tests/runtime.test.ts:86,716                                                                                                          |
| Stable resource identity        | `src/domain/model.ts:158–166; src/workspace/workspace.ts:550–740`  | tests/runtime.test.ts:86; tests/browser/workspace.spec.ts:139–160                                                                     |
| Typed custom values             | `src/domain/model.ts:167–203; src/workspace/workspace.ts:648–696`  | tests/runtime.test.ts:86; Exact four-kind values, zero/false, archived text and IDs preserved across transfers, redeploy and recovery |
| Item lifecycle                  | `src/workspace/workspace.ts:648–696`                               | tests/runtime.test.ts:86; archive/restore status and active listing asserted                                                          |
| Non-destructive field archival  | `src/domain/model.ts:167–203; src/workspace/workspace.ts:582–613`  | tests/runtime.test.ts:165; browser grouping fallback/restoration                                                                      |
| Conflict detection              | `src/workspace/workspace.ts:169–176,550–740`                       | tests/runtime.test.ts:86; tests/browser/workspace.spec.ts:164–186                                                                     |
| Durable commits                 | `src/workspace/workspace.ts:61–112,550–777`                        | tests/runtime.test.ts:86,418; Live content/identity persist after eviction; pending event/delivery budget persists after redeploy     |
| Portable export and restoration | `src/domain/model.ts:204–262; src/workspace/workspace.ts:938–1016` | tests/contracts.test.ts:103; tests/runtime.test.ts:418; browser restore; Exact live transfer in both directions passed                |

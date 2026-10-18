# MVP verification record

Verified locally in the managed workspace on 2026-10-17 using Node.js 24,
Wrangler 4.151.1 / its installed workerd runtime, and Chromium.

## Completed

- Production client build, TypeScript typecheck, generated binding inspection,
  and Wrangler deployment dry run resolving WORKSPACE, ASSETS, and environment vars.
- Local Wrangler startup without Cloudflare account authentication. The app serves
  owner login and rejects unauthenticated content requests. Local data uses its
  documented persistence directory and no remote binding is enabled.
- Twelve runtime/contract tests exercising schema/item IDs, all four field kinds,
  zero/false/unset, rename compatibility, archive/restore, stale revisions,
  atomic rejection, injected event-transaction failure, pagination (including equal
  timestamps), Unicode search/cursors, body limits, scoped tokens and revocation,
  origin/host checks, Secure hosted-origin cookie semantics, key rotation,
  bootstrap-placeholder rejection, login throttling, the documented external client
  against a real local HTTP listener, persistence after runtime
  reconstruction, isolated instances, snapshot round trips and credential exclusion,
  unsupported schema rejection, webhook signature/tamper/replay checks, family
  selection, retry budgets, duplicate alarm execution, disabling and manual retry.
- Browser journey against a real Wrangler local server: owner login, pristine
  snapshot restoration, custom Research type, select field/options, item creation,
  board move, external API edits after renaming type/field/option, polling refresh,
  draft preservation during external changes, explicit stale-save conflict,
  field archival/list fallback, and restoration of grouping.
- Board population with 102 items proves the UI follows more than one API page.
  Search/no-results, token issuance/one-time disclosure, snapshot export and
  exclusion of credentials also exercised through the browser.
- Axe accessibility checks pass for desktop Connections and the narrow workspace.
  A 360-pixel viewport has no document-wide overflow; native dialogs keep keyboard
  focus and close with Escape. [Desktop](images/workspace.png) and
  [mobile](images/mobile.png) screenshots contain test data only, no secrets.

Runtime tests use a fixture that corrects Miniflare's synthetic ingress Host and
exposes SQL/alarm fault injection only for testing. The production Worker bundle
is checked for absence of these RPC helpers. Synthetic HTTPS-origin tests verify
application semantics; they are not evidence of a real hosted deployment.
Webhook network requests are intercepted by the runtime test transport; real
public delivery is not claimed from mocked receipt verification.

## Hosted acceptance completed

Cloudflare access was initially unavailable. On 2026-10-18 the
owner approved public publication and created the public
[source repository](https://github.com/dasarpemrograman/malleable-workspace)
after repository creation through the integration was denied. The source and Git
history are published there, and the README deployment button targets that source.
Cloudflare deployment history now confirms a `dash_template` deployment with the
expected bindings; the detailed report distinguishes that evidence from direct
interaction with the original dashboard flow.

On 2026-10-18 the owner supplied the deployed origin
https://male2.alfikrona.workers.dev/. Read-only HTTPS checks confirmed the root
serves the application HTML (200). `/auth/session`, `/api/v1/capabilities`,
`/api/v1/schema`, `/api/v1/items`, `/owner/connections`, `/owner/export`, and an
unknown API route all reject unauthenticated requests with JSON (401) and
`Cache-Control: no-store`. The protected-route checks also establish that a
configured Worker/Durable Object responds; they do not establish successful
owner login, content operations, guided provisioning, webhook delivery, or
recovery.

The owner subsequently supplied the deployed key through an ignored local file.
Authenticated HTTPS checks passed: login (200); Secure, HttpOnly,
SameSite=Strict cookie; session, capabilities, schema, items, and connections
reads (200 with no-store); unknown API route (404 JSON); logout (200); and a
protected read after logout (401). Workspace content and schema were not changed.
The key and cookies are excluded from the verification output and Git.

Cloudflare OAuth was subsequently completed through the waiting Wrangler callback
listener. `wrangler whoami` now confirms authentication. Read-only Cloudflare
deployment/version queries for `male2` succeed: deployment history includes
`dash_template`, and the deployed version declares ASSETS, OWNER_KEY as a secret,
WEBHOOK_ALLOWED_HOSTS, and the WORKSPACE Durable Object binding.

The remaining acceptance checks were then executed using an isolated test app
and public receiver. Fresh provisioning, missing-secret lockout, scoped API and
revocation, live schema renames, signed receipt, pending delivery across redeploy,
explicit object eviction, hosted SQLite checkpoint recovery, hosted browser
interaction, and exact snapshot transfers in both directions passed. All 32
OpenSpec tasks are now checked. Both temporary Workers and their Durable Object
namespaces were deleted; the `male2` application was not redeployed or modified.

See the [final verification report](openspec-verification.md) and
[sanitized live evidence](verification/hosted-2026-10-18.json). Four coverage
warnings remain; passing acceptance does not establish every edge scenario.

## Practical boundaries

One owner/workspace per deployment. Local and hosted stores are independent.
Restoration is restricted to pristine targets and does not restore credentials.
Alarms can redeliver or leave receipt unknown within the three-slot budget; verify
and deduplicate at receivers. Event/delivery history currently grows without
compaction. Local receiver hostname/DNS trust differs from hosted public egress.
The deploy-button link and hosted template deployment are available. The report
records the original dashboard-observation and managed-browser proxy limitations.

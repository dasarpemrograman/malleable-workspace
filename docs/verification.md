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

## Not completed: live account-dependent acceptance

`wrangler whoami` reports no authenticated Cloudflare account. The connected GitHub
identity can authenticate, but the intended repository does not exist and prior
creation was denied by its integration. No public template URL is available.

These checks remain open in OpenSpec:

- 7.2: real deploy-button provisioning and receipt at an authorized public receiver.
- 7.3: real hosted redeploy/eviction and hosted checkpoint recovery.
- 8.1: hosted half of the full UI/API/customization/webhook journey.
- 8.2: actual local-to-hosted and hosted-to-local transfer (the same code path has
  passed simulated cross-origin/runtime transfer checks).

A public source repository and authorized Cloudflare account are required to
finish those checks. No temporary cloud account, public source publication, or
cloud resource deployment was substituted for that missing access.

## Practical boundaries

One owner/workspace per deployment. Local and hosted stores are independent.
Restoration is restricted to pristine targets and does not restore credentials.
Alarms can redeliver or leave receipt unknown within the three-slot budget; verify
and deduplicate at receivers. Event/delivery history currently grows without
compaction. Local receiver hostname/DNS trust differs from hosted public egress.
The deploy-button link is deliberately pending, not a working placeholder badge.

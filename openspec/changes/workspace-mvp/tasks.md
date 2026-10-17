# Tasks

These are unstarted implementation tasks. Only planning artifacts are changed by this proposal. Live deployment checks require an authorized Cloudflare account and a real public template source; do not mark them complete from a dry run.

## 1. Workers project and local workflow

- [ ] 1.1 Add the TypeScript/React/Vite client, Worker entry point, shared validation, Workers binding types, Node.js tooling engine, dependency lockfile, and build/typecheck/dry-run scripts; verify a clean install and Worker bundle build without Fastify, a standalone Node server, or a native SQLite dependency.
- [ ] 1.2 Add `wrangler.jsonc` with static assets, protected-route Worker-first handling, the `WORKSPACE` class binding, pinned compatibility date/public-fetch routing, and the initial `new_sqlite_classes` migration; verify generated types and a dry run resolve all bindings and unknown API routes return JSON rather than SPA HTML.
- [ ] 1.3 Add local owner-key generation, ignored `.dev.vars` and `.wrangler/state`, and a documented build-plus-Wrangler development command with loopback binding and explicit persisted local bindings; verify a clean checkout starts without Cloudflare login, does not call remote bindings, preserves existing secrets, and excludes secret/state files from Git and asset uploads.
- [ ] 1.4 Document and exercise local setup, state paths, restart/reset behavior, offline use after installation, and separate local instances; verify creating an item, stopping/restarting with the same directory, and starting another directory preserve the expected identities and isolation.

## 2. Durable model, transactions, and migrations

- [ ] 2.1 Implement fixed-name workspace routing and application SQL migration 1 in the SQLite Durable Object, with minimal defaults, pristine state, version checks, and protected initialization; verify one empty editable type, stable workspace identity after object recreation, and no caller-created object proliferation.
- [ ] 2.2 Implement type/field/option creation and renaming, field archive/restore, and schema revisions through shared operations; verify stable references, archived-value recovery, and rejection of field-kind changes, option removal, and permanent schema deletion.
- [ ] 2.3 Implement revision-aware item creation/read/update/archive/restore and value clearing; verify all four kinds, unset/false/zero distinctions, immutable item type, wrong-type fields/options, atomic mixed-invalid writes, and stale-revision conflicts.
- [ ] 2.4 Atomically commit item/schema mutations, immutable resource-snapshot events, matching delivery rows, and the required earliest alarm using supported storage transactions; verify injected failures leave no partial mutation/event/queue state and object recreation retains acknowledged changes and scheduled work.
- [ ] 2.5 Add deterministic cursor listing, combined type/archive/title/body filtering, and bounded validation; verify equal-timestamp pagination, invalid cursors, all published limits, and no prototype-sensitive value merging in runtime tests.
- [ ] 2.6 Add versioned atomic application migrations, hosted checkpoint recording where supported, and documented local snapshot recovery; verify compatible redeploy/schema behavior, unsupported-version rejection, and the guide distinguishes class migrations, SQL migrations, hosted recovery bookmarks, and local recovery.

## 3. Owner access and stable API

- [ ] 3.1 Implement fail-closed environment-secret validation, owner login/logout, expiring session digests, key-rotation invalidation, loopback local access, hosted HTTPS/Secure cookies, Host/Origin validation, and durable bounded login throttling; verify missing/example keys, unauthorized content reads, cross-origin and missing-origin owner mutations, cookie attributes, rotation, and forged client-address headers.
- [ ] 3.2 Implement scoped token creation, digest-only persistence, one-time disclosure, listing, and immediate revocation; verify read-only, write-only, schema-only, invalid/revoked tokens, and rejection of external-token access to owner-management routes.
- [ ] 3.3 Expose version 1 capabilities/schema/types/fields/options/items through the same operations for UI and bearer clients, with private no-store responses and machine-readable errors; verify local and hosted-origin request cases preserve identical contract/revision behavior and protected API requests cannot fall through to cached assets.
- [ ] 3.4 Deliver the OpenAPI contract and executable examples for discovery, item read/write, rename compatibility, and independently configured instances; verify examples locally, add hosted HTTPS variants, and document scopes, concurrent pagination, remote reachability, and absence of MCP/ACP or automatic peer synchronization.

## 4. Durable outbound connections

- [ ] 4.1 Implement owner-only subscriptions, explicit event-family selection, signing-secret issuance, disabling, and a default-empty operator-controlled exact-host allowlist; verify matching-event enqueueing, secret redaction, no sends after disable, and external clients cannot broaden destinations.
- [ ] 4.2 Implement HTTPS URL/hostname policy, per-attempt allowlist checks, public Workers fetch routing, TLS verification, no private-network bindings/overrides, no redirects, and request timeouts; verify IP literals, localhost/local names, credentials, non-443 ports, removed hosts, self-targeting origins, and redirects are rejected in controlled transport tests. Document local hostname/DNS trust without promising DNS/IP pinning.
- [ ] 4.3 Implement Web Crypto HMAC signatures and a bounded alarm pump with durable attempt reservations/leases, earliest-due scheduling, concurrency two, and restart recovery; verify stable event bytes/IDs, fresh attempt timestamps, signatures, 2xx-only success, three-slot budgets, duplicate alarm invocation, constructor wake-up behavior, and no fourth automatic request after exhaustion.
- [ ] 4.4 Implement redacted delivery history and owner-triggered bounded retry; verify manual retry keeps the original event identity, preserves past attempt accounting, and does not block editing when receivers fail. Deliver and execute mocked receiver verification/deduplication examples and document uncertain receipts, event content disclosure, and history growth.

## 5. Workspace interface

- [ ] 5.1 Build owner login, empty collection, schema-driven item edit/archive/restore, search, and type filtering; verify offline local browser flows, no-results versus empty states, validation messages, and draft preservation after failed saves.
- [ ] 5.2 Build type/field/option settings and field archive/restore controls with kind-change limitations; verify a Research type's fields appear only on its items and label changes preserve existing IDs and values.
- [ ] 5.3 Add list and saved select-field board views, Unset columns, keyboard/touch move controls, and invalid-grouping fallback; verify renamed columns, archived-field fallback, restart persistence, and board membership beyond the first API page.
- [ ] 5.4 Add focus/visible-window refresh without overwriting drafts; verify external API edits appear, stale edits show a conflict with reload controls, and background refresh does not replace unsaved input.
- [ ] 5.5 Add connection settings with current environment/API URL, token/subscription controls, explicit receiver disclosure, delivery status, and manual retry; verify loopback and hosted HTTPS examples, one-time secrets, revocation, allowlist guidance, and visible failed-delivery outcomes.
- [ ] 5.6 Check keyboard navigation, accessible names/statuses, dialog focus, and 360-pixel layouts across item/schema/connection flows; verify automated accessibility checks and record a keyboard/narrow-screen walkthrough.

## 6. Portable recovery

- [ ] 6.1 Implement consistent versioned snapshot export and validated atomic pristine-instance restore with a 10 MiB bound, no provider-specific files, and no source credentials/subscriptions/history; verify local and hosted-origin round trips, ID/value/archive/view preservation, invalid references/formats/oversize input, target-owner access, and non-pristine rejection.
- [ ] 6.2 Add confirmed export/restore UI and instructions for both transfer directions; verify a browser restore into a fresh instance and document source retirement, separate secrets, no automatic synchronization, and local-state deletion consequences.

## 7. Deployable template and release operation

- [ ] 7.1 Prepare build/deploy scripts, the real-source Deploy to Cloudflare badge, Durable Object migration declarations, secret-example prompts, binding descriptions, and default configuration; verify dry-run provisioning inputs, no secret/state inclusion, user-selected Worker names, and documentation accurately marks an unavailable public source rather than advertising a working placeholder.
- [ ] 7.2 Using an authorized Cloudflare account and an actual public source repository, exercise the complete deploy-button flow into a fresh namespace; verify automatic binding provisioning, configured owner login, fail-closed missing-secret behavior, scoped API access over HTTPS, and signed receipt at an allowlisted receiver. Leave this task incomplete if source/account access is unavailable.
- [ ] 7.3 Verify a compatible hosted redeploy/object eviction retains workspace identity, content, token revocation, pending deliveries, and retry budgets; execute the documented recovery path and record platform-limit/cost considerations and any live-only limitations in the operator guide.

## 8. Cross-environment MVP acceptance

- [ ] 8.1 Run the proposal journey locally and on the deployed instance: UI creation, API read, type/field/option renames, board switch, API update through original IDs, UI refresh, signed delivery, and runtime/object recreation; verify local runs use no Cloudflare credentials/remote bindings and report hosted checks separately from mocked transport coverage.
- [ ] 8.2 Execute local-to-hosted and hosted-to-local snapshot transfer into pristine targets, with identity preservation, excluded connections, destination owner access, and environment isolation; record results without claiming synchronization.
- [ ] 8.3 Run typecheck, client/Worker build, dry-run bundle validation, Workers domain/API/alarm tests, browser checks, and offline local-start smoke tests; verify passing results and an updated README with accurate deployment prerequisites and implemented-versus-deferred behavior.

## Workflow follow-up

- Review this revised proposal before implementation through `openspec-apply-change`.
- Publishing a public template or deploying cloud resources is outside this proposal-only action; use the authorized implementation/release workflow for those actions.
- Archive only after implementation and acceptance checks, including the live template flow, are complete.

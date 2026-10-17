# Tasks

All tasks are implementation work for a later apply phase. None are complete merely because this proposal exists.

## 1. Runtime and storage foundation

- [ ] 1.1 Add the TypeScript/React/Vite/Fastify project structure, Node.js 24 runtime floor, dependency lockfile, and development/build/start/typecheck scripts; verify a clean install, typecheck, and production build succeed on the documented runtime.
- [ ] 1.2 Add SQLite migration 1, UUID-backed records, foreign-key enforcement, protected local data paths, and the minimal pristine workspace; verify first launch creates exactly one editable type and no items, a restart preserves its identity, and data/credential files are ignored by Git.
- [ ] 1.3 Add consistent pre-migration backups and unsupported-version rejection; verify a migration test restores its backup and the storage guide explains local paths, native dependency prerequisites, and rollback.

## 2. Domain operations and durable events

- [ ] 2.1 Implement type, field, and select-option creation/renaming plus field archival/restoration and schema revisions; verify stable-ID rename cases, archived-value preservation, and rejection of field-kind changes and permanent deletion.
- [ ] 2.2 Implement item creation, reading, partial updates, value clearing, archival/restoration, and expected-revision checks; verify all four field kinds, unset/false/zero distinctions, wrong-type fields, unknown options, immutable item type, and atomic rejection of mixed valid/invalid edits.
- [ ] 2.3 Commit each content/schema mutation with its immutable resource-snapshot event and matching delivery rows in one transaction; verify a forced transaction failure persists neither mutation nor event, failed validation emits no event, and accepted edits/events survive restart.
- [ ] 2.4 Implement title/body search, type/archive filters, deterministic cursor pagination, and resource limits; verify equal-timestamp traversal, combined filters, malformed cursors, oversize inputs, and documented error codes in domain/API examples.

## 3. Owner access and public API

- [ ] 3.1 Implement owner-key bootstrap, login/logout/session handling, loopback binding, Host/Origin checks, and login rate limiting; verify unauthorized access, cross-site mutations, missing-origin owner mutations, wrong hosts, and excessive login attempts are rejected without leaking secrets.
- [ ] 3.2 Implement scoped token creation, digest storage, listing, and revocation with owner-only management; verify read-only, write-only, schema-only, revoked, and invalid token behavior and that secrets appear only in issuance responses.
- [ ] 3.3 Expose capabilities, schema, and item/type/field/option routes through shared domain operations with revision-aware responses; verify UI-session and bearer-token requests enforce identical domain validation and forbidden owner endpoints remain inaccessible to external tokens.
- [ ] 3.4 Deliver the version 1 OpenAPI contract and runnable curl/script examples for discovery, item creation/readback, rename compatibility, and two independent local instances; verify those examples against ephemeral instances and document the local reachability and concurrent-pagination limits.

## 4. Outbound connections

- [ ] 4.1 Implement owner subscription creation, event-family selection, disabling, and one-time signing-secret disclosure; verify only matching events created while enabled queue deliveries and disabling prevents further queued attempts.
- [ ] 4.2 Implement HTTPS destination validation, DNS/IP classification and pinning, TLS hostname validation, redirect rejection, and policy-compatible proxy handling; verify private IPv4/IPv6, mapped addresses, DNS rebinding, URL credentials, redirects, and unsupported safe proxy paths produce visible failures without reaching forbidden targets.
- [ ] 4.3 Implement HMAC signing, worker concurrency/timeouts, durable claiming/restart recovery, three-attempt cycles, and owner-triggered retry; verify exact-byte signatures, fresh retry timestamps with stable event identity, 2xx-only success, timeout/failure exhaustion, duplicate-safe redelivery, and editing while receivers are offline.
- [ ] 4.4 Expose redacted delivery history and retry status, and document the receiver verification/deduplication example, resource snapshot disclosure, feedback-loop responsibility, and history growth; verify the example against an injected test transport without weakening production destination restrictions.

## 5. Workspace interface

- [ ] 5.1 Build the owner login and empty collection surface with item creation/edit/archive/restore, schema-driven field controls, search, and type filtering; verify browser flows preserve drafts on save errors, distinguish empty/no-results states, and work without internet access.
- [ ] 5.2 Build type/field/option settings including field archival/restoration and immutable-kind explanations; verify browser tests cover creating a Research type and renamed definitions appearing in existing items without ID changes.
- [ ] 5.3 Add list and configurable select-field board views, Unset grouping, keyboard/touch move controls, saved preferences, and grouping-field fallback; verify view persistence, renamed option columns, field archival fallback, and complete board membership beyond one API page.
- [ ] 5.4 Add focus/visibility refresh and five-second visible-window polling without discarding drafts; verify an external API update appears in the UI and a conflicting edit preserves input and offers reload rather than silently overwriting.
- [ ] 5.5 Build token/subscription settings and delivery inspection/manual retry with one-time secret displays; verify owner-only controls, revocation, receiver-failure messages, and clear local-access/content-sharing explanations.
- [ ] 5.6 Check keyboard navigation, accessible control names, dialog focus, non-color status cues, and 360-pixel layouts across item/schema/connection flows; verify automated accessibility checks plus a documented keyboard and narrow-screen walkthrough.

## 6. Portable recovery

- [ ] 6.1 Implement versioned consistent exports and fully validated, transactional pristine-instance restoration with credential/history exclusion; verify ID/value/archive/view round trips, wrong-version/broken-reference rejection, non-pristine rejection, preserved target owner access, and no restored subscriptions or historical deliveries.
- [ ] 6.2 Add owner export/restore controls with replacement confirmation and a recovery guide; verify a browser round trip and execute the documented restore procedure on a second fresh instance.

## 7. MVP integration acceptance

- [ ] 7.1 Run the complete proposal acceptance journey: UI creation, API read, type/field/option renames, board switch, API update through original IDs, UI refresh, signed outbound receipt, restart persistence, and export/restore; verify one integration report records the outcomes and remaining limitations.
- [ ] 7.2 Run production build, typecheck, domain/API/delivery/browser suites, and an offline startup smoke check; verify all pass and the README provides working startup instructions with accurate implemented-versus-deferred scope.

## Workflow follow-up

- Review this proposal before beginning implementation through `openspec-apply-change`.
- Archive only after implementation and acceptance checks are complete; GitHub repository creation remains a separate integration-permission issue.

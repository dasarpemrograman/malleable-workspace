# Design

## Context

See `proposal.md` for the MVP and `specs/workspace-deployment/spec.md` for the requested deployment behavior. The repository contains OpenSpec tooling and unimplemented planning artifacts only. The previous Fastify/native SQLite design was never built; this revision replaces it before implementation.

Cloudflare Workers is now the selected runtime for both hosted and local use. All choices below remain proposed. This turn edits planning artifacts only: no dependencies, Wrangler configuration, runtime code, public repository, or cloud resources are created.

## Goals / Non-Goals

**Goals:** one Worker application and storage model in both environments; a short guided deployment; no Cloudflare login for local operation; stable resource identities and domain behavior; durable delivery without an always-running process.

**Non-Goals:** a standalone Node backend, automatic local/cloud synchronization, multi-tenant SaaS, browser-offline editing against a hosted workspace, or provider-independent backend deployment. Local offline use means running the Workers development runtime locally after dependencies and secrets are installed.

## Decisions

### 1. Worker entry point, static assets, and a single workspace object

Use TypeScript and React with Vite to build the browser assets, a Workers `fetch` entry point for routing, and Zod for shared validation. Use standard Request/Response and Web Crypto APIs, not Fastify, Node HTTP servers, `better-sqlite3`, filesystem persistence, or a Node background daemon. Node.js 24 is the tooling target, not the production execution environment; update the tooling engine declaration during implementation.

The Worker serves assets through an `ASSETS` binding and forwards API/authentication/owner-management requests to `WORKSPACE`, a SQLite-backed Durable Object class. Route all workspace calls to a fixed deployment-local object name such as `primary`. Keep its internal storage identity separate from the public workspace UUID so snapshot restore does not change routing. Never derive new object names from unauthenticated request paths or caller-provided workspace IDs.

Configure Worker-first routing for protected route prefixes so missing API routes return JSON errors, not the SPA fallback. Public static assets contain no secrets or user content. Authenticated responses use `Cache-Control: no-store`. The Durable Object is not directly exposed as a public endpoint; it validates sessions/scopes itself rather than trusting client-supplied principal headers.

Proposed layout: `src/worker/` for routing and binding types, `src/workspace/` for the Durable Object and SQL migrations, `src/domain/` for validation and commands, `src/client/` for React, `tests/` for runtime/browser checks, and `docs/` for operation and API guidance.

**Alternative:** D1 plus Queues would work but split the workspace, outbox, and scheduling across more products. A SQLite-backed Durable Object colocates the transactions and alarm state needed by this personal workspace. Separate Node/local and Workers/cloud backends would multiply compatibility work.

### 2. Wrangler is the source of deployment and local-runtime configuration

During implementation, add `wrangler.jsonc` with a stable Worker name, pinned compatibility date, `ASSETS`, the `WORKSPACE` class binding, and the initial class migration using `new_sqlite_classes`. Class migration tags and the exported class name must remain stable across deployments. No D1, KV, R2, Queues, VPC, private-network, AI, or external service binding is required for the MVP.

Keep Vite as the client asset builder. Make the documented local command build the client and invoke Wrangler local development with loopback binding and an explicit `.wrangler/state` persistence directory. The intended workflow is `npm ci`, `npm run setup:local`, then `npm run dev`; setup generates a random local owner key without cloud calls. Expose a separate dry-run bundle check and a deployment command that builds assets before `wrangler deploy`. Configure the build/deploy scripts so the guided Cloudflare flow detects them correctly.

Wrangler and the Cloudflare Vite plugin both use Miniflare/workerd; Wrangler is selected here to keep one explicit configuration and persistence path. A future optional Vite-plugin HMR workflow must not become another backend or silently use different local state.

Local bindings remain simulated; do not set `remote: true` or use `--remote` in the normal workflow. Keep `.wrangler/`, `.dev.vars`, generated bundles, snapshots, and secrets out of Git and uploaded assets. A local runtime restart keeps the same storage directory. Separate checkout/state directories are separate workspaces.

**Alternative:** remote development would upload code and use cloud resources, which does not meet the local requirement. A second local SQL adapter is unnecessary because Wrangler simulates the actual Durable Object APIs.

### 3. Template deployment and explicit owner setup

During implementation, add the documented Deploy to Cloudflare button pointing at the actual public GitHub/GitLab template URL. The flow clones the source for the user, builds/deploys it, and provisions the declared Durable Object binding. Include the class migration and stable default binding names; no manual database ID or D1 migration step is needed.

Provide `.dev.vars.example` with a non-working `OWNER_KEY` placeholder and a package-level Cloudflare binding description telling deployers to generate a unique random secret. The deploy flow uses the example file to request the Worker secret. Reject missing, example, or insufficiently strong owner keys at runtime; an accidentally deployed unconfigured Worker never becomes publicly writable. Local setup writes an owner-only `.dev.vars` file and tells the user where to read it; it neither prints the secret in ordinary logs nor overwrites an existing key silently.

Do not require a separate application account, OAuth provider, Cloudflare Access configuration, or custom domain. The deployed workers.dev HTTPS origin is sufficient. The owner supplies a key through the login screen; no public setup or first-visitor claim endpoint exists.

The repo has no GitHub remote today and repository creation was previously denied. A working public template URL is a release prerequisite, not something this proposal can fabricate. Do not publish source or create/deploy resources during planning. Implementation can prepare the template locally, but the live button acceptance task remains unfinished until the real source and authorized deployment account are available. A dry run alone does not prove the guided deployment works.

**Alternative:** unauthenticated setup after deployment creates an ownership race. Requiring Cloudflare Access would add account/policy setup before an owner can use the template.

### 4. Durable SQLite records and shared transactions

Preserve the existing model: immutable UUIDs for workspace, items, types, fields, options, views, tokens, subscriptions, events, and deliveries. Names are labels, never foreign keys. Persist types, immutable-kind fields, option IDs, items with plain-text bodies and ID-keyed values, view preferences, token digests/scopes, sessions, subscriptions, and delivery state in the object's SQL storage. Start with one editable Item type, no fields, and no records.

Keep four optional field kinds: text, finite number, checkbox, and single select. Distinguish unset, false, and zero. Item type and field kind cannot change after creation. Archive fields/items without deleting content; archived fields remain discoverable and reject writes until restored. Options can be added and renamed but not removed. Use expected revisions for PATCH operations and reject stale edits atomically.

Use parameterized `ctx.storage.sql.exec()` calls within storage transactions. SQL transaction statements are not the transaction API; use `ctx.storage.transaction()` when including alarm updates and the appropriate synchronous transaction API for synchronous SQL-only work. Revalidate resource revisions and schema inside the transaction. Commit content, immutable event bytes, delivery rows, and the required next alarm together. Do not await external network calls inside a transaction or rely on in-memory state for durability.

Use a bounded alarm pump rather than one timer per delivery: schedule the earliest due pending work. Changes that enqueue deliveries must not move an earlier alarm later. Initialization uses durable migration state and `blockConcurrencyWhile` as appropriate; it must not overwrite a pending alarm unconditionally when an evicted object restarts.

**Alternative:** ordinary isolate memory and `setTimeout` disappear on eviction; a post-response promise does not provide a durable queue. Stable IDs remain the integration foundation independently of where the object runs.

### 5. Authentication and the public API in local and hosted modes

Use the same scoped bearer tokens and owner-session authorization model in both modes. The environment supplies `OWNER_KEY`; do not store the plaintext owner key in SQL. Store random external-token and session digests, not their secrets. Use expiring host-only HttpOnly/SameSite=Strict cookies; require Secure on hosted HTTPS and permit local HTTP only on loopback. Logout removes the session. Tie each session to a key-derived credential epoch so owner-key rotation invalidates existing sessions; document that separate scoped integration tokens are revoked explicitly.

Fail closed when the owner secret is not configured. Require browser mutation Origin to equal the request's served origin, reject Host/URL inconsistencies, and never infer trusted origins from caller-supplied forwarded headers. Local Wrangler binds only to loopback by default. Hosted routing supplies the deployed HTTPS origin; a configured custom domain can serve the same application without replacing its data namespace. Do not enable cross-origin browser API access. No-Origin CLI requests must authenticate with a scoped bearer token and cannot use that exception for owner-session actions.

Rate-limit login attempts using durable state: 10 failed attempts per minute per client identity plus a bounded aggregate limit to resist distributed attempts. Hosted client identity uses Cloudflare-provided request metadata, never an untrusted forwarded address; local mode uses its local identity. Bound and expire rate-limit records. Return no personal data in errors or health/configuration responses.

Keep `/api/v1/capabilities`, `/schema`, `/types`, `/fields`, `/options`, and `/items` as proposed. Scopes are independently grantable `workspace:read`, `items:write`, and `schema:write`. External tokens cannot manage credentials, views, subscriptions, snapshots, or restore. Write-only tokens receive their authorized mutation result, not general read access.

API version, schema revision, export version, event version, and SQL migration version remain separate. Rename/addition/archive operations do not bump API major version. Use 409 for stale revisions, 422 for invalid values, 400 for malformed requests, 401 for failed authentication, 403 for insufficient scope, 404 for missing resources, and 413 for oversized bodies. Document machine-readable error codes.

Retain deterministic `(createdAt, id)` cursor pagination with default page size 50 and maximum 100, title/body search, type filtering, and optional archived inclusion. A cursor is validated against its filters; concurrent edits are not a snapshot guarantee. Enforce the previous ordinary limits: 1 MiB request bodies, 240-character titles/names, 100,000-character bodies, 100 fields per type, 100 options per field, 10,000-character text values, and 2,048-character webhook URLs. Reject unsupported prototype-sensitive properties instead of merging arbitrary object keys. Cap snapshots at 10 MiB to leave headroom for validation/restore within Workers resource constraints; make this explicit in capabilities and tests.

### 6. Alarm-driven webhooks with an explicit destination boundary

Retain immutable events with `version`, `id`, `workspaceId`, `type`, `resourceId`, `resourceRevision`, `occurredAt`, non-secret `actor`, and `data` containing the post-mutation resource snapshot. Event types cover item create/update/archive/restore, type create/update, field create/update/archive/restore, and option create/update. Token/view/subscription management does not emit content events. Subscription selection explicitly covers item events, schema events, or both.

The alarm handler reserves due attempts transactionally before networking, performs at most two concurrent fetches in a bounded batch, then persists outcomes and schedules remaining work. Reserve attempt numbers and a lease deadline durably. An interrupted attempt consumes its slot; after its lease expires, a later attempt may resend the same event. Scheduling uses the earliest pending due time or in-flight lease expiry. Catch normal delivery failures and persist/reschedule them; platform alarm retries must resume durable attempt state rather than reset counters.

Keep three automatic request slots per cycle, a 10-second request timeout, and retry delays of 10 then 60 seconds. Only 2xx succeeds. The owner can retry an exhausted failed delivery as a new bounded cycle. Disable prevents future claims but cannot undo an in-flight request. Delays are earliest eligible times, not precise execution guarantees. Runtime crashes can leave an uncertain receipt; document duplicate-capable best-effort delivery within bounded attempts, not guaranteed receipt or exactly once. Once slots are exhausted no automatic alarm retry may issue a fourth request.

Sign `timestamp + "." + rawBody` with Web Crypto HMAC-SHA256. Keep the headers `X-Workspace-Event-Id`, `X-Workspace-Timestamp`, and `X-Workspace-Signature: sha256=<hex>`. Retry preserves event ID/body and creates a new timestamp/signature. Receiver examples use constant-time verification, five-minute timestamp tolerance, and `(workspaceId, eventId)` deduplication. Store signing keys in private object storage, disclose them only at subscription creation, and never include them in logs/exports.

The previous Node design's arbitrary DNS lookup and connection pinning is not portable to Workers fetch. Replace that unimplemented mechanism explicitly: `WEBHOOK_ALLOWED_HOSTS` is an operator-controlled exact DNS-hostname allowlist, empty by default, not editable by external tokens or ordinary subscription requests. Permit only HTTPS on port 443; reject IP literals, localhost/local-domain names, URL credentials/fragments, redirects, and self-targeting protected application origins. Check the allowlist every attempt. Owners must configure trusted public receivers deliberately; local delivery is not an untrusted-URL fetch service.

Hosted delivery uses global fetch with `global_fetch_strictly_public`, normal TLS verification, and manual redirect handling. Bind no VPC/service/private network egress and set no private-origin/resolve overrides. This flag enforces public routing for a Worker's zone; it is not a general DNS-pinning API. Local workerd does not inherit the hosted network boundary, so document the trust placed in the operator's allowlisted hostname/DNS and test local URL-policy enforcement separately. No claim of arbitrary-host DNS/IP pinning parity is made. Test receivers use injected/mocked transport without relaxing production URL rules.

**Alternative:** keeping a Node-specific pinned-connection promise would require a second egress implementation or relay. Trusted explicit destinations plus public Workers routing fit a single-owner MVP with less infrastructure. Stronger hostile-URL/DNS isolation would need a separate egress design.

### 7. UI and portable recovery remain platform-neutral

Keep schema-driven item editing, search/filter, list and select-field board views, Unset columns, keyboard/touch move controls, and archived-grouping fallback. Saved views are projections, not integration schemas. Refresh after mutations, on focus, and every five seconds while visible without replacing unsaved drafts. Show conflicts explicitly. Core screens work at 360 pixels and via keyboard.

Connections settings show the current environment and API base URL: loopback HTTP locally, the actual HTTPS origin when hosted. Explain event content disclosure, hostname allowlist configuration, scoped tokens, delivery outcomes, and lack of automatic synchronization. Hosted services can call the hosted API directly with a token; local tools call the loopback API. Two instances remain separate peers; examples do not auto-forward all incoming events and create loops.

Export a consistent versioned JSON snapshot containing workspace UUID, types/fields/options, items and archived values, and saved views. Exclude owner key, tokens, sessions, subscriptions, and event/delivery history. Fully validate the supported format, IDs, references, values, counts, and 10 MiB limit before atomic replacement.

Restore only when the pristine marker remains true: owner-created items, schema changes, view changes, token issuance, or subscriptions mark it non-pristine; login/export do not. Retain the destination's environment-provided owner key and preserve exported IDs/revisions. Create one local `workspace.restored` audit event without replaying historical deliveries. Retire the source when performing an identity-preserving replacement; a fork is not a synchronized copy. Export/restore works in either direction without access to raw Durable Object database files.

### 8. Migrations, release checks, and recovery

Separate append-only Wrangler Durable Object class migration tags from transactional per-object application schema migrations. Reuse the same class binding, namespace, and fixed object name across compatible redeployments. Initialize a fresh namespace only for a deliberately separate instance.

Prefer additive SQL migrations so the previous code remains readable during rollback. Before an existing-schema upgrade, record a recoverable checkpoint: a hosted SQLite Durable Object PITR bookmark where supported, or a portable snapshot for local recovery. Document hosted bookmarks separately from the guaranteed cross-environment snapshot path; do not promise local PITR parity. Never silently downgrade a newer application schema. Incompatible rollback requires compatible code and an explicit recovery operation, not merely redeploying old JavaScript.

Use Workers runtime tests with simulated bindings and controlled alarm execution, plus browser tests against Wrangler local development. Deployment acceptance additionally requires a real Cloudflare account and public template source: provisioning, fail-closed startup, scoped HTTPS API use, redeploy preservation, and alarm recovery. Report a missing account/source as an uncompleted live check, not a passed dry run.

## Risks / Trade-offs

- Cloudflare coupling: runtime/storage use Workers APIs; portable snapshots preserve data ownership, but provider-independent hosting is not part of this MVP.
- Free/paid quotas and cost: SQLite-backed Durable Objects are available on both plans, but limits can reject work and usage can incur charges; link current official limits rather than promise unlimited free operation.
- Object/storage growth and compute limits: keep scans, batches, retry budgets, payloads, and snapshots bounded; document that event history retention/compaction is deferred.
- Local persistence is a development-runtime feature: keep the persistence directory intact and use snapshots for recovery/transfer; deleting `.wrangler/state` deletes that local workspace.
- Local/cloud divergence: separate namespaces and secrets are intentional; moving content requires explicit export/restore, with no implied offline browser synchronization.
- Hostname trust in local webhook delivery: only operators choose allowlisted receivers; public Workers routing and local egress are different trust boundaries, and neither is described as Node-style DNS pinning.
- Public deployment bootstrap: a Worker without a valid owner secret stays locked; there is no insecure shared default or first-visitor owner claim.
- Bounded alarm retries: duplicate execution and unknown receipt are possible; durable budgets and event IDs make recovery observable and deduplication possible.
- A deploy button needs public source: repository creation/publication and an authorized account remain prerequisites to live release verification.

## Migration Plan

1. Implement the Worker, Durable Object, local commands, owner-secret setup, and static assets without introducing a second server/storage adapter.
2. Verify clean local startup with no Cloudflare credentials, offline editing, restart persistence, API rename compatibility, and controlled alarm recovery.
3. Prepare the template binding/class migration, secret example/description, build/deploy scripts, and documentation. Publish a real button only when an authorized public source exists.
4. On an authorized Cloudflare account, verify the guided fresh deployment, lockout without a secret, owner login, scoped API and webhook flows, and state retention across redeployments.
5. Verify local-to-hosted and hosted-to-local snapshot restoration into pristine instances; document key/subscription exclusion and source retirement.
6. Keep old class migrations and namespaces intact. For rollback, deploy schema-compatible code or perform explicit documented checkpoint recovery; never reset an existing namespace as an upgrade shortcut.

## Sources

Official documentation inspected for this proposal on 2026-10-17:

- [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/): public source template, guided provisioning, scripts, and secret examples.
- [Workers local development](https://developers.cloudflare.com/workers/local-development/): Miniflare/workerd execution, local simulated bindings, and separation from remote bindings.
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/): an alternative supported local frontend workflow.
- [Durable Object storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/): persisted private storage and SQLite class migration declarations.
- [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/): transactions and hosted point-in-time recovery.
- [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/): durable scheduling, duplicate execution, and automatic handler retries.
- [Global fetch public routing](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public): public routing behavior for same-zone subrequests.
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): plan availability and quota/cost considerations.

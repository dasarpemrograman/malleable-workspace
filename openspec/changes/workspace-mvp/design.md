# Design

## Context

See `proposal.md` for motivation and product scope. Inspection found only the OpenSpec dependency, generated agent skills, and setup documentation; there are no runtime modules, tests, or existing capability specs. This is a new local application, not a migration of an existing product.

The user requested the proposal before implementation. All architecture and dependency choices below are proposed. This change's implementation remains unstarted.

## Goals / Non-Goals

**Goals:** keep identity and authorization independent of presentation; make every mutation available through one validated domain operation; commit data and outbound intent atomically; keep operation practical for a single local user.

**Non-Goals:** a universal ontology, executable user code, distributed consistency, automatic schema translation, or transparent remote access. A compatible rename and a change of meaning are different operations; this MVP supports renames and additive structure, not arbitrary semantic migration.

## Decisions

### 1. One local process, one same-origin browser application

Use TypeScript, React, and Vite for the browser; Fastify for the HTTP server; SQLite through `better-sqlite3` for persistence; and shared runtime validation with Zod. Target Node.js 24 LTS for the application. This raises the application's runtime floor from the repository's current tooling-only Node.js minimum; implementation must update package metadata and documentation together.

During development, Vite proxies application requests to the local server. Production serves built assets and the API from one loopback origin. No runtime CDN, third-party login, analytics service, or model provider is required. Use locally packaged assets and system fonts.

Proposed layout: `src/server/` for HTTP and delivery, `src/domain/` for operations and schemas, `src/storage/` for SQLite and migrations, `src/client/` for React, `tests/` for behavior checks, and `docs/` for the API and operator guide.

Alternatives: browser-only storage makes external inbound access awkward; an Electron shell adds packaging before the integration model is proven; a hosted service adds deployment and account requirements. A JSON file is simpler initially but provides weaker transaction and queue guarantees than SQLite.

### 2. Separate stable content from mutable presentation

Use UUIDs for workspace, type, field, option, item, view, token, subscription, event, and delivery IDs. Display names are never foreign keys or property names in the published contract. Internal SQLite migration version, public API version, event envelope version, export format version, and workspace schema revision are separate values.

Persist these logical records:

| Record | Key content |
| --- | --- |
| Workspace | ID, display name, schema revision, pristine marker |
| Type | ID, display name, revision |
| Field | ID, type ID, display name, immutable kind, archived flag, revision |
| Select option | ID, field ID, display name, revision |
| Item | ID, immutable type ID, title, body, values keyed by field ID, archive flag, revision, timestamps |
| View | ID, mode, selected type ID, optional grouping field ID, revision |
| Access token | ID, display name, secret digest, scopes, revocation time |
| Subscription | ID, URL, selected event families, signing secret, enabled flag |
| Event / delivery | Immutable envelope and body; per-subscription state, attempts, next attempt time |

Start with one editable type named Item, no fields, and no sample content. All custom fields are optional. Select values contain option IDs, numbers must be finite, and absent values are different from false or zero. Item titles are required after trimming; bodies remain plain text.

Field kind and an existing item's type cannot change in the MVP. Archive fields instead of dropping them. Store archived definitions and values, return them in schema/item API reads, and reject writes to archived fields. Unarchive restores editing. Select options can be added and renamed; removing options and permanently deleting schema are unavailable. Renaming a label never changes identity or coerces values.

Alternatives: name-keyed JSON is easy to inspect but breaks renames; requiring every workspace to share fixed Task/Project models undermines malleability; unrestricted type conversion requires explicit migration contracts and belongs in a later proposal.

### 3. Shared operations and explicit revisions

Domain operations accept a principal and validated command; adapters do not write directly to storage. Check scope, expected resource revision, resource ownership, active field definitions, and value kinds before opening the write transaction. Use parameterized SQL. Recheck the expected revision within the transaction, persist the new revision and the event/outbox rows, and return the committed result.

Use a resource's `revision` in PATCH bodies, including schema resources. Return HTTP 409 with `revision_conflict` on mismatch. Unknown resources return 404; validation returns 422; malformed JSON returns 400; authentication returns 401; scope denial returns 403; oversized requests return 413. Errors use `{ "error": { "code", "message", "details" } }` and do not include credentials or stack traces.

The client refreshes current data after mutations and on window focus, and polls every five seconds while visible so external edits appear without a second transport. Preserve local drafts during refreshes and conflicts. No live multi-user editing is implied.

Alternatives: separate UI-only commands can drift from integration semantics; last-write-wins can silently discard local or external edits.

### 4. Small version 1 API surface

| Surface | Operations |
| --- | --- |
| `/api/v1/capabilities` | GET workspace identity, versions, kinds, operations, limits |
| `/api/v1/schema` | GET types, fields, options, archived markers, revisions |
| `/api/v1/types` and `/:id` | POST create, PATCH rename |
| `/api/v1/fields` and `/:id` | POST create, PATCH rename/archive/restore |
| `/api/v1/options` and `/:id` | POST create, PATCH rename |
| `/api/v1/items` and `/:id` | GET list/read, POST create, PATCH content/archive/restore |
| Owner session routes | Login, logout, current session |
| Owner management routes | Views, tokens, subscriptions, delivery status/retry, snapshot export/restore |

Publish an OpenAPI document for public routes and examples using curl and a small script. Mutation bodies reject unknown top-level keys, but field-value keys are validated IDs and stored without prototype-sensitive merging. `schema:write` does not imply read or item-write access. Any scope combination can be granted deliberately; write-only clients receive the result of their own authorized mutation, not general read access.

List responses use `{ items, nextCursor }`; page size defaults to 50 and is capped at 100. Use deterministic `(createdAt, id)` ordering and an opaque cursor validated against the active filters. Pagination is a traversal of current state, not a cross-request snapshot. Document that concurrent modifications can affect membership.

Initial published limits: 1 MiB ordinary request bodies, 240-character titles and display names, 100,000-character item bodies, 100 fields per type, 100 options per select field, 10,000-character text values, and 2,048-character webhook URLs. Snapshot upload is separately capped at 50 MiB with a full preflight validation. Authentication attempts are limited to 10 failed attempts per minute per local client address. These values become part of capabilities and test cases.

Version 1's envelope and operation semantics stay stable through supported customization. Schema changes increment schema revision, not API major version. A future breaking field-conversion or executable extension must introduce explicit migration/capability semantics rather than silently reinterpreting a v1 value.

### 5. Local owner access and scoped integrations

On first launch, generate an owner key in a local file with owner-only permissions. The server stores its digest, accepts it through a login form, and issues an HttpOnly, SameSite=Strict session cookie. Session state survives only as needed for normal operation and is never exported. Owner actions require this session; external bearer tokens cannot access owner management routes. Keep generated secrets out of URLs, bundles, source control, and application logs.

Bind to `127.0.0.1` by default, allow only explicitly configured loopback host names and the configured port, require the configured Origin on browser mutations, and do not enable cross-origin API access. CLI clients without an Origin must use bearer authentication; they cannot bypass owner-session origin checks. Rate-limit login attempts. Changing network exposure is not a supported deployment mode in this release.

Issue cryptographically random API tokens, show them once, store only digests, and compare secrets without leaking partial matches. Signing secrets must remain recoverable to sign webhooks; store them only in the protected local data store, never in read responses. Set the data directory to owner-only access, including SQLite sidecar files and the owner key. Local disk encryption is the operating system's responsibility.

Alternatives: an unauthenticated loopback server is vulnerable to browser-mediated requests; a full OAuth provider adds substantial machinery before remote multi-user use exists. Separate read/write/schema scopes bound what locally authorized tools can do.

### 6. Transactional outbound events and bounded delivery

Each item/schema transaction inserts an immutable event plus delivery rows for matching currently enabled subscriptions. Event types are `item.created`, `item.updated`, `item.archived`, `item.restored`, `type.created`, `type.updated`, `field.created`, `field.updated`, `field.archived`, `field.restored`, `option.created`, and `option.updated`. Each envelope contains `version`, `id`, `workspaceId`, `type`, `resourceId`, `resourceRevision`, `occurredAt`, `actor`, and `data`. `data` contains the post-mutation resource snapshot, not unrelated workspace content. Owner view/token/subscription actions do not generate content events.

Worker delivery is independent of HTTP mutation responses. Use a single worker with concurrency two, transactional claiming, and a recovery path for interrupted attempts on startup. Preserve committed event bytes for replay. Keep a bounded response diagnostic (status/error category, not arbitrary receiver response bodies).

Use headers `X-Workspace-Event-Id`, `X-Workspace-Timestamp`, and `X-Workspace-Signature: sha256=<hex>`. Sign `timestamp + "." + rawBody` with the subscription secret. Timestamp is Unix seconds at attempt time. Receiver examples compare signatures in constant time, enforce a five-minute timestamp tolerance, and deduplicate on `(workspaceId, eventId)`.

Timeout each request after 10 seconds and allow three attempts per cycle: immediately, then after 10 seconds, then after 60 seconds. Only 2xx is success. The owner can retry a failed delivery as another bounded cycle, with the same event ID/body and fresh timestamps. No ordering guarantee, exactly-once guarantee, or automatic peer forwarding is offered. External handlers must avoid feedback loops; this MVP does not automatically copy events into another workspace.

For HTTPS destinations, reject URL credentials/fragments, resolve DNS, reject any non-public IPv4/IPv6 result including mapped IPv4 forms, and connect to a validated address while preserving the hostname for TLS/SNI verification. Revalidate and pin for every attempt, do not follow redirects, and use a tested address classification library rather than ad hoc string matching. An environment proxy must enforce equivalent destination restrictions; do not bypass required proxy policy. Surface inability to deliver safely as a failed attempt.

Alternatives: synchronous webhooks make offline editing unreliable; an external message broker adds an operational dependency; arbitrary URL fetches can reach private services. Public HTTPS receivers and local inbound API clients prove the two directions without shipping networking infrastructure.

### 7. Views remain projections

The browser shows a restrained collection surface with a prominent create action, search, type filter, view switch, and settings. The item editor renders fields from schema. Settings provide separate schema, connections, and recovery screens so implementation details do not fill normal item flows.

A board selects one type and one of its active select fields. Columns reference option IDs and include Unset. An explicit move control supports keyboard and touch; dragging is optional, not required. The list remains available if the grouping field is archived. Persist view preferences without changing item semantics. Make dialogs focus-managed and controls usable at 360 pixels.

Alternatives: hard-coded status columns make the first board a task manager; mandatory drag-and-drop excludes keyboard and some touch usage; an arbitrary canvas requires a new layout model before core interoperability is tested.

### 8. Export, restore, and migration

Use numbered SQLite migrations with a recorded version; take a consistent SQLite backup before applying any migration to an existing database. Never auto-downgrade. Do not commit data files, owner keys, exports, or credentials.

Export uses a consistent read transaction and a versioned JSON envelope containing workspace identity, schema, items, archived content, and view preferences. Exclude tokens, sessions, subscriptions, event/delivery history, and owner credentials. Validate references, value kinds, IDs, counts, and format version before restore.

Restoration is allowed only while a fresh instance's pristine marker remains true: any owner-created content, schema change, saved view change, token issuance, or subscription creation makes it non-pristine. Login and export do not. Replace fresh defaults atomically, preserve exported resource IDs, increment no restored resource revisions, mark non-pristine, and keep the target instance's newly generated owner credential. No old connections resume. As initialization, restoration creates a local `workspace.restored` audit event, not a replay of historical item events or deliveries. Cloning a snapshot is not a federation mechanism; retire the old instance before treating a restore as its replacement.

Alternatives: restoring into a populated workspace requires merge/conflict semantics; copying credentials silently could reconnect the wrong instance to external services.

## Risks / Trade-offs

- Limited malleability: stable IDs handle names and projections, not arbitrary changes of meaning. Reject field-kind/type reassignment and keep migration work explicit.
- Single SQLite writer and synchronous driver: keep transactions short and delivery outside them; this is a personal workspace, not a high-concurrency service.
- Native SQLite dependency: test installation on the documented Node/platform combination; packaging beyond the development/start workflow is deferred.
- Full resource snapshots in webhooks disclose content to configured receivers: explain this before subscription creation and require explicit event-family selection.
- Duplicate deliveries and feedback loops: document event deduplication and source identity; do not auto-forward peer events.
- Offline delivery eventually exhausts its budget: show failure and allow manual retry; do not promise automatic indefinite catch-up.
- Events and delivery history grow over time: expose a documented local-storage limitation for the MVP; retention/compaction requires a later proposal rather than silent event loss.
- Local-server deployment limits reachability: tools on the same device can call it immediately; remote inbound connectivity requires a later supported deployment proposal.
- Snapshot restore preserves identity: do not concurrently run restored copies as if they were a single synchronized workspace.

## Migration Plan

1. During implementation, add the application runtime floor, dependency lockfile changes, startup scripts, schema migration 1, and ignored local data directory.
2. Start a fresh instance, exercise the cross-surface acceptance scenario, and verify restart persistence and empty-instance recovery.
3. Document local startup, first-owner login, token issuance, webhook signature verification, limits, and the boundary around remote access.
4. Roll back a pre-release build by stopping it and restoring the matching database backup before starting its predecessor. Exports are a portable recovery path, not an automatic schema downgrade.

No existing user database or production deployment exists today. GitHub repository creation remains blocked by integration permissions and is not a prerequisite for local implementation.

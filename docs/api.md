# Version 1 API

Base URL is `/api/v1` at the current instance. Local is loopback HTTP; hosted is
HTTPS. Tools send `Authorization: Bearer <secret>`. Create scoped tokens through
owner Connections settings. Do not place them in URLs or commit them to scripts.
Owner browser sessions also use these domain routes, with same-origin checks.
Cross-origin browser access is not enabled. CLI clients can use bearer tokens
without an Origin header. Owner routes require a browser session and matching
Origin for mutations; external tokens cannot use them.

Read access requires `workspace:read`; item creation/PATCH requires `items:write`;
schema creation/PATCH requires `schema:write`. Scopes do not imply each other.
A write-only tool can see its own mutation response, but cannot enumerate data.
Revocation takes effect on the next request.

| Method / path | Contract |
| --- | --- |
| GET `/capabilities` | Workspace UUID, API/schema/event versions, kinds, limits |
| GET `/schema` | Types, fields (including archived), options, schema revision |
| POST `/types` | `{name}` |
| PATCH `/types/:id` | `{revision, name?}` |
| POST `/fields` | `{typeId, name, kind}` |
| PATCH `/fields/:id` | `{revision, name?, archived?}` |
| POST `/options` | `{fieldId, name}` for an active select field |
| PATCH `/options/:id` | `{revision, name?}` |
| GET `/items` | Cursor-paginated collection |
| GET `/items/:id` | Full item, including stored archived-field values |
| POST `/items` | `{typeId, title, body?, values?}` |
| PATCH `/items/:id` | `{revision, title?, body?, values?, archived?}` |

All resource IDs are UUIDs. Custom value keys are field IDs. Select values are
option IDs. Names are labels, never identifiers. Supported kinds are optional
text, finite number, checkbox, and single select. A missing value is unset, and
is different from false/zero. A PATCH `values` object changes only its listed
keys; null removes a value. Unlisted values are preserved. Archived fields remain
readable but reject edits until restored. Field kind and an existing item's type
cannot change. Archival is reversible; permanent schema deletion is unavailable.

Every update requires the current revision. A successful update increments it;
a stale update returns 409 `revision_conflict` and does not overwrite data.
Creation returns 201 and the full resource. Validation is identical in UI and API;
data, event, delivery rows and alarm intent commit together.

Item query parameters: `q` searches title/body, `typeId` filters by type,
`archived=true` includes both active and archived items, `limit` defaults to 50
(maximum 100), and `cursor` continues the same filters. Response is
`{items, nextCursor}`. Ordering is `(createdAt,id)`; concurrent modifications can
change membership, so this is not a cross-request snapshot. URL-encode cursors.

Limits: request bodies 1 MiB; titles/names 240 characters; bodies 100,000
characters; text values 10,000 characters; 100 fields per type; 100 options per
select field. Snapshot owner routes use a separate 10 MiB limit. Login permits
10 failed attempts per minute per client and 100 aggregate; caller-supplied
forwarded headers are not used as authenticated client identity.

Errors use `{error:{code,message,details?}}`. Statuses: 400 malformed JSON/cursor,
401 invalid session/token, 403 insufficient scope/origin/host, 404 missing resource,
409 stale revision or invalid state transition, 413 body limit, 422 invalid data,
429 login throttle, 503 missing owner configuration, 500 unexpected failure.
Errors contain no credentials or internal stack traces.

## Example

Set WORKSPACE_URL and WORKSPACE_TOKEN privately, then run `node
examples/roundtrip.mjs`. That script discovers the schema, creates an item using
a type ID, reads it back, and prints its public ID/title only. Use the same script
with two different base URLs/tokens to connect to independent instances. A peer
service can read A and explicitly create something on B using separate tokens;
there is no automatic copying, identity translation, or event-forwarding loop.

`docs/openapi.json` is the public bearer API contract. Owner-management routes are
browser surfaces, not a shortcut to additional permissions for external tools.

MCP/ACP adapters and automatic synchronization are not implemented.

# Operation, deployment, and recovery

## Local use

`npm run dev` builds the React client and runs `wrangler dev --local --ip
127.0.0.1 --persist-to .wrangler/state`. All application bindings are simulated
locally. It does not log into Cloudflare or read/write a deployed namespace.
Dependencies must already be installed for offline use. Outbound webhook delivery
needs network access and eventually exhausts its bounded retry budget offline.

The owner key is in `.dev.vars`, not a URL, asset, or database export. Read it
privately when signing in. `npm run setup:local` does not overwrite an existing
file and sets owner-only permissions. Protect the local `.wrangler` directory
using your OS account and disk protections; SQLite dev state is not encrypted by
the application. Do not share local explorer/debug ports or bind the dev server
publicly. Wrangler's own development administration endpoints are not production
application endpoints and must stay on a trusted local machine.

To run another independent local instance, give Wrangler another port and
persistence path. Use a separate checkout/secrets file if it needs a different
owner key. Never point ordinary development at production bindings. Client code
changes need another `npm run build`; Wrangler watches the Worker source.

## Hosted use

`npm run build` creates only browser assets under `dist`. `npm run bundle`
performs a deployment dry run; `npm run deploy` builds and deploys. The Wrangler
configuration has only ASSETS and the SQLite Durable Object WORKSPACE; no external
database, broker, AI service, or separate backend server is required.

The public-source deploy button must target a real public GitHub/GitLab repository.
The repository's build/deploy scripts and `new_sqlite_classes` declaration support
guided provisioning. `.dev.vars.example` describes the required Worker secret;
package metadata explains it in the configuration UI. Never use its placeholder.
Generate a unique random 32-byte base64url key, keep a private copy, and supply it
through the guided secret field or `wrangler secret put OWNER_KEY`.

An unconfigured deployment returns a configuration error for protected routes.
Static login assets are public; content is not. The hosted cookie is host-only,
HttpOnly, SameSite=Strict, Secure, and expires after 12 hours. Owner key rotation
invalidates existing owner sessions. Scoped tool tokens are separately revoked
in Connections; rotating the owner key does not silently revoke them.

Set WEBHOOK_ALLOWED_HOSTS to an exact JSON hostname list, initially `[]`. Changing
the hostname list is an operator action, not a scoped integration operation.
Hosted delivery uses public Workers fetch routing. No VPC/private-origin bindings
or DNS override should be added without reviewing that boundary.

Cloudflare quotas can reject requests/storage work; alarms and delivery work can
consume billable usage. Consult current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).
No unlimited free-tier guarantee is made. Event, attempt, and delivery history are
retained and can grow; retention/compaction is a follow-up feature. UI refresh runs
only while visible, but still contributes requests.

## Export and restore

Export & restore downloads a consistent version 1 JSON snapshot, at most 10 MiB.
It includes workspace/resource IDs, revisions, types, fields, options, archived
items and values, and views. It excludes owner keys, sessions, tool tokens,
subscriptions/signing keys, event history, and delivery attempts.

Restore works in either direction between local and hosted instances. The target
must be pristine: no owner-created items, schema changes, saved view changes,
tokens, or subscriptions. Login and export alone do not make it non-pristine.
Select the snapshot, confirm replacement, and keep using the target's owner key.
Malformed/unsupported/oversized snapshots are rejected without partial replacement.

The target retains source content IDs but has its own access configuration.
Reissue tokens and create subscriptions deliberately. Retire the source when
replacing an identity; running two restored copies does not synchronize them.
Export first before deleting a local persistence directory.

## Migrations and rollback

Wrangler class migrations are append-only namespace/class declarations; preserve
the `v1` tag and exported Workspace class. The fixed object name `primary` is an
internal routing identity; restoring a public workspace UUID does not change it.
Do not switch bindings or recreate namespaces as an upgrade shortcut.

Application SQL migrations are versioned inside the object and transactional.
Newer unsupported schemas refuse initialization. The initial schema is version 1.
The migration framework records a hosted PITR bookmark before upgrading an existing
stored schema where that API is available. For local upgrades, create a portable
snapshot before applying new code; do not assume hosted PITR APIs exist locally.

Redeploying schema-compatible code should retain data and pending delivery state.
Deploying old JavaScript alone is not a database rollback. Prefer additive schema
changes; if incompatible, stop writes, use a known-compatible build and explicit
checkpoint recovery. Hosted PITR is an operator procedure using the supported
[SQLite recovery API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
not an unauthenticated app endpoint. Local recovery restores a snapshot into a
fresh state directory. Preserve original state until the replacement is verified.

## Acceptance evidence

See [verification record](verification.md). A clean build/dry run tests packaging,
not Cloudflare account provisioning. Live deploy-button, hosted redeploy/eviction,
and local↔hosted transfer tasks must remain open until exercised on an authorized
account with a public template source.

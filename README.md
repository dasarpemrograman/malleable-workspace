# Malleable Workspace

A small personal workspace you can reshape without breaking its connections.
Create your own item types and fields, use lists or boards, and connect tools
through a stable API and signed outbound webhooks.

Want to improve it? Start with the [contributor guide](CONTRIBUTING.md).

Runs on **Cloudflare Workers**, with a SQLite-backed Durable Object. The same
backend runs locally using Wrangler; no Cloudflare login is needed for local use.

## Run locally

Requires Node.js 24 or newer and npm. After installing dependencies, local editing
works without internet access.

```sh
npm ci
npm run setup:local
npm run dev
```

Open **http://127.0.0.1:8787**. Read `OWNER_KEY` from the generated `.dev.vars`
file and enter it at the login screen. Setup preserves an existing key, creates
new keys with owner-only file permissions, and does not print them to logs.
Keep this file private. Do not reuse the example placeholder.

Your data lives in `.wrangler/state`. Restarting keeps it; deleting it deletes
that local workspace. Local and hosted instances have separate data and keys.
Use Export & restore to transfer a workspace explicitly.

## Deploy to Cloudflare

The application includes its Worker entry point, static asset build, Durable
Object binding/class migration, secret example, and guided-deployment metadata.
A Cloudflare account is required only for hosted deployment.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fdasarpemrograman%2Fmalleable-workspace)

The button uses this public repository. Hosted deployment and live acceptance
results are recorded in [verification status](docs/verification.md), including
remaining coverage warnings.

The [Deploy to Cloudflare flow](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
clones the public source and provisions the declared binding. Supply a unique
random 32-byte base64url `OWNER_KEY` when prompted. No shared default or public
ownership-claim endpoint exists; missing/example secrets leave the app locked.

For an existing authorized account and checkout:

```sh
npx wrangler login
npx wrangler secret put OWNER_KEY
npm run deploy
```

Use the deployed HTTPS URL and the supplied owner key. See [deployment and recovery](docs/operations.md)
for secret rotation, migration, retry, isolation, and rollback details. Account
limits and charges apply; this is not a promise of unlimited free operation.

## Update an existing deployment

Use the [reviewed upstream update workflow](docs/updates.md) to prepare a PR in
your copy, then merge it to your connected Cloudflare Workers Builds production
branch. Enrollment protects the existing Worker and namespace and preserves
provider settings. Copies do not automatically receive upstream commits.

## Connect a tool

In **Connections**, issue a token with only the scopes the tool needs:
`workspace:read`, `items:write`, and/or `schema:write`. Copy its secret once.

```sh
export WORKSPACE_URL=http://127.0.0.1:8787
# Set WORKSPACE_TOKEN privately to a newly issued read + item-write token.
node examples/roundtrip.mjs
```

The same example works against a deployed HTTPS URL. Names can change while IDs
and the v1 API remain stable. See [API documentation](docs/api.md) and the
[OpenAPI contract](docs/openapi.json).

Outbound receivers are disabled until the operator configures an exact-host
allowlist. Set `WEBHOOK_ALLOWED_HOSTS` to a JSON array of trusted public DNS
hostnames in `.dev.vars` locally or Worker settings for an enrolled hosted copy.
Restart locally; hosted upgrades preserve provider settings. Only HTTPS on
port 443 is accepted. Local DNS is trusted; this is not an arbitrary-URL proxy.
Receivers get content snapshots. Read [webhook verification](docs/webhooks.md)
before configuring a destination.

## Checks

```sh
npm run typecheck
npm test
npm run test:browser
```

Browser checks use an installed Chromium (set `CHROMIUM_PATH` if needed), run a
separate instance on port 8788, and reset only `.wrangler/browser-tests`.
Runtime tests use simulated Workers storage and a test-only fixture with fault
injection; its RPC helpers are never included in the production Worker.

## MVP boundaries

One owner and one workspace per instance. Four optional field kinds: text,
number, checkbox, and select. Fields/items can be archived and restored. No
permanent schema deletion, field-kind conversion, existing item type changes,
MCP/ACP adapter, executable extensions, multi-user collaboration, or automatic
local/cloud synchronization is included.

The implementation follows [OpenSpec workspace-mvp](openspec/changes/archive/2026-10-18-workspace-mvp/proposal.md),
archived with its five [main specifications](openspec/specs/) synced.
Local and live Cloudflare acceptance results are recorded in
[the verification report](docs/openspec-verification.md); local runtime tests
and a bundle dry run do not substitute for a deployed test.

Run `npm run openspec:init` to install or refresh all 12 official OpenSpec
workflows for Codex: propose, explore, new, continue, apply, update, ff, sync,
archive, bulk-archive, verify, and onboard. The command uses a temporary custom
profile so your global OpenSpec preferences stay intact. Codex exposes these as
skills in `.agents/skills/`, including `openspec-verify-change`.

<!-- Disposable contribution CI acceptance branch; do not merge. -->

# Proposal

Archived status (2026-10-18): implemented and verified, with all 32 tasks complete
and five main specs synced. The text below records proposal-time context;
statements about absent application code or unavailable public source describe
that earlier stage. See the [verification report](../../../../docs/openspec-verification.md)
for implemented behavior and remaining coverage warnings.

## Why

A personal workspace should adapt as its owner's work changes without forcing every connected tool to relearn its structure. This MVP will test that promise with a Cloudflare Workers application that is simple to deploy and also usable locally through the Workers development runtime.

The repository currently contains OpenSpec tooling only: there is no application, existing runtime contract, or durable capability specification to preserve.

## What Changes

- Ship one single-user Workers application with a browser UI and API, deployable to the owner's Cloudflare account and runnable locally with simulated bindings and persisted local state. Start empty, with one editable item type and no imposed task methodology, sample records, or AI account requirement.
- Use Workers Static Assets, one SQLite-backed Durable Object per deployment, and Durable Object alarms for delivery scheduling. Replace the earlier standalone Node server/native SQLite design; do not maintain a second backend for local use.
- Provide a Deploy to Cloudflare button backed by a public template repository, Wrangler binding/class migration declarations, and owner-secret setup. Keep local development independent of Cloudflare login, deployed resources, and production data.
- Let users create and edit items, define types and custom fields, rename or archive fields, search, and switch between list and board views. A board groups by a user-defined select field rather than a built-in task status.
- Give workspaces, items, types, fields, and select options stable IDs independent of their display names. Keep version 1 of the integration contract compatible across the supported customizations.
- Expose authenticated discovery, schema, and item operations through a versioned HTTP API. The UI and external clients use the same domain operations and validation.
- Send signed change events to explicitly configured HTTPS webhooks. Show delivery status and support manual retry, so another workspace or service can react to local changes.
- Persist data in the selected runtime's Durable Object storage and support portable export and restoration into an empty local or hosted instance. Local and hosted workspaces remain separate unless the owner explicitly transfers a snapshot.

### Scope choices

**Confirmed intent:** radical malleability, minimal defaults, connections in both directions, Cloudflare Workers deployment through a deploy button, and local use through Workers local development. The user delegated MVP product choices and requested this proposal before implementation.

**Selected MVP defaults:** one owner and one workspace per deployment/local state directory; TypeScript/React on Workers; SQLite-backed Durable Objects; four custom-field kinds (text, number, checkbox, select); list and board views; REST plus outbound webhooks; and an owner key supplied as a Worker secret or local `.dev.vars` value. These are proposed product decisions for review. Hosted use requires a Cloudflare account; local use does not after dependencies are installed.

**Deferred:** arbitrary executable extensions, changing an existing field's kind, deleting schema permanently, multi-user collaboration, automatic local/cloud synchronization, general peer federation, non-Workers backend portability, AI-driven restructuring, and MCP/ACP adapters. The first release proves bidirectional interoperability through HTTP; it does not claim all protocols are supported. Which ACP protocol to support remains open for a later adapter proposal and does not block this MVP.

## Capabilities

### New Capabilities

- `workspace-model`: durable items and user-defined schemas, stable identities, non-destructive customization, export, and empty-instance restoration.
- `workspace-interface`: an initially empty workspace with item editing, schema editing, search, list and select-field board views, and connection management.
- `workspace-api`: authenticated versioned discovery and schema/item operations whose contracts survive supported customization.
- `workspace-events`: transactional change events, signed outbound webhooks, visible delivery outcomes, and bounded/manual retries.
- `workspace-deployment`: template-based Workers deployment, protected hosted startup, persisted local development, environment isolation, and local/cloud transfer.

### Modified Capabilities

None. `openspec list --specs` reports no existing specifications.

## Impact

- Introduces a browser client, a Worker entry point, a SQLite-backed Durable Object, an authenticated API, and alarm-driven webhook delivery. Exact layout and dependency choices are defined in `design.md`.
- Adds runtime dependencies, build/start scripts, integration tests, and operator/API documentation during implementation. This proposal does not install dependencies or write application code.
- Stores content and connection data in the owner's selected local/cloud environment. Requires scoped authorization, protected hosted cookies, fail-closed owner-secret setup, request validation, explicit outbound destinations, and documented recovery.
- No breaking changes to an existing application: the replaced Node/Fastify/native SQLite architecture was never implemented. Platform coupling, usage limits, and possible Cloudflare charges become documented deployment trade-offs.
- The deploy button needs a public GitHub/GitLab source repository. GitHub creation is currently blocked by integration permissions; prepare the template during implementation, but mark the live button journey unverified until a real public source and deployment account are available. Publishing source is not part of this proposal action.

## MVP Acceptance

Run the app locally without Cloudflare login or remote bindings. Create a type with a select field, add an item through the UI, and read it through the API. Rename the type, field, and option, switch to a board, and update the item through its original IDs. Verify UI refresh, signed delivery, and persistence after a local runtime restart.

Use the deploy button from a real public template repository to provision a separate hosted instance with a configured owner secret. Verify unauthenticated access is blocked, repeat the API/customization journey over HTTPS, and verify delivery resumes after object eviction. Export the local workspace and restore it into a pristine hosted workspace with IDs preserved and old credentials/subscriptions excluded. Do not claim local/cloud synchronization or a completed live deployment without those checks.

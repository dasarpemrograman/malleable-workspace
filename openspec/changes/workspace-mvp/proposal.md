# Proposal

## Why

A personal workspace should adapt as its owner's work changes without forcing every connected tool to relearn its structure. This MVP will test that promise with a small usable workspace and a stable, bidirectional integration boundary.

The repository currently contains OpenSpec tooling only: there is no application, existing runtime contract, or durable capability specification to preserve.

## What Changes

- Ship a single-user workspace that runs locally and works without an internet connection. Start empty, with one editable item type and no imposed task methodology, sample records, or AI account requirement.
- Let users create and edit items, define types and custom fields, rename or archive fields, search, and switch between list and board views. A board groups by a user-defined select field rather than a built-in task status.
- Give workspaces, items, types, fields, and select options stable IDs independent of their display names. Keep version 1 of the integration contract compatible across the supported customizations.
- Expose authenticated discovery, schema, and item operations through a versioned HTTP API. The UI and external clients use the same domain operations and validation.
- Send signed change events to explicitly configured HTTPS webhooks. Show delivery status and support manual retry, so another workspace or service can react to local changes.
- Persist data locally and support portable export and restoration into an empty instance.

### Scope choices

**Confirmed intent:** radical malleability, minimal defaults, and connections in both directions. The user delegated MVP product choices and requested this proposal before implementation.

**Selected MVP defaults:** one owner, one workspace per running instance, a local browser UI backed by a local server, four custom-field kinds (text, number, checkbox, select), list and board views, REST plus outbound webhooks, explicit human configuration, and no required cloud service. These are proposed product decisions for review, not requirements previously supplied by the user.

**Deferred:** arbitrary executable extensions, changing an existing field's kind, deleting schema permanently, multi-user collaboration, device synchronization, general peer federation, hosted deployment, AI-driven restructuring, and MCP/ACP adapters. The first release proves bidirectional interoperability through HTTP; it does not claim all protocols are supported. Which ACP protocol to support remains open for a later adapter proposal and does not block this MVP.

## Capabilities

### New Capabilities

- `workspace-model`: durable items and user-defined schemas, stable identities, non-destructive customization, export, and empty-instance restoration.
- `workspace-interface`: an initially empty workspace with item editing, schema editing, search, list and select-field board views, and connection management.
- `workspace-api`: authenticated versioned discovery and schema/item operations whose contracts survive supported customization.
- `workspace-events`: transactional change events, signed outbound webhooks, visible delivery outcomes, and bounded/manual retries.

### Modified Capabilities

None. `openspec list --specs` reports no existing specifications.

## Impact

- Introduces a browser client, a local application server, a SQLite data store, an authenticated API, and a webhook delivery worker. Exact layout and dependency choices are defined in `design.md`.
- Adds runtime dependencies, build/start scripts, integration tests, and operator/API documentation during implementation. This proposal does not install dependencies or write application code.
- Stores personal content and connection credentials locally. Requires local file protection, authorization scopes, request validation, safe outbound delivery, and documented backup behavior.
- No breaking changes to an existing application. Repository creation on GitHub remains a separate permission blocker and does not prevent local development.

## MVP Acceptance

Create a type with a select field, add an item through the UI, and read it through the API. Rename the type, field, and option, switch to a board, then update that same item through its original IDs using an external client. The UI must reflect the update and a configured receiver must obtain a signed event. Restart the server and verify the data persists; export and restore it into an empty instance without restoring old credentials.

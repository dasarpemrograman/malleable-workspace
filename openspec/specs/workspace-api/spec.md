# workspace-api Specification

## Purpose

Allow external clients and other workspace instances to discover and operate on workspace data through explicit, stable, authorized contracts.

## Requirements

### Requirement: Owner authentication in each environment
The application SHALL require owner authentication before reading workspace data or managing connections. Local use MUST bind to loopback by default; hosted use MUST require HTTPS with Secure session cookies. Browser mutations MUST reject cross-origin requests and use protected same-origin sessions. Owner credentials MUST NOT be embedded in static assets or URLs.

#### Scenario: Unauthenticated access
- **WHEN** a caller without a valid session or token requests workspace content
- **THEN** the server rejects the request without returning personal data

#### Scenario: Cross-site browser request
- **WHEN** another website attempts an authenticated browser mutation or a request supplies a Host header inconsistent with the served origin
- **THEN** the request is rejected without changing the workspace

#### Scenario: Hosted deployment has no owner secret
- **WHEN** a deployed instance has a missing, invalid, or known example owner secret
- **THEN** protected routes fail closed with a configuration error and no workspace content is disclosed
- **AND** a visitor cannot claim ownership through a public setup endpoint

#### Scenario: Hosted session protection
- **WHEN** the owner logs into the hosted HTTPS origin
- **THEN** the session cookie is Secure, HttpOnly, and SameSite=Strict
- **AND** logout or owner-secret rotation invalidates the affected sessions

### Requirement: Scoped external tokens
The owner SHALL be able to issue and revoke bearer tokens with any subset of `workspace:read`, `items:write`, and `schema:write`. External tokens MUST NOT manage credentials, subscriptions, export, or restore. Revocation SHALL take effect on the next request. Token secrets MUST not be retrievable after issuance or stored in plaintext.

#### Scenario: Read-only tool
- **WHEN** a tool uses a token containing only `workspace:read`
- **THEN** it can discover the workspace and read schema and items
- **AND** item and schema writes are rejected

#### Scenario: Revoked token
- **WHEN** the owner revokes a token and its holder sends another request
- **THEN** that request is rejected as unauthenticated

### Requirement: Versioned discovery
Authenticated clients SHALL be able to discover workspace ID, API contract version, supported operations, field kinds, event envelope version, and integration limits at `/api/v1/capabilities`. The response MUST distinguish API contract version from mutable schema revision. Incompatible future contracts SHALL require a new API major version.

#### Scenario: Discovery after customization
- **WHEN** a client discovers capabilities before and after the owner adds a custom field
- **THEN** the API major version remains 1 and the schema revision reflects the change

### Requirement: Schema and item access
The version 1 API SHALL expose schema reading, type creation and renaming, field creation/renaming/archival/restoration, select-option creation and renaming, and item creation/reading/updating/archival/restoration. Resource references and custom-value keys MUST use IDs rather than display names. Item lists SHALL support bounded cursor pagination, title/body search, type filtering, and optional archived-item inclusion.

#### Scenario: External item creation
- **WHEN** an authorized client creates an item using discovered type and field IDs
- **THEN** the API returns its ID and revision and the item becomes visible in the workspace UI

#### Scenario: Paginate without skipping equal timestamps
- **WHEN** a client requests successive pages of an unchanged collection containing items with equal timestamps
- **THEN** every matching item appears once with a deterministic continuation cursor

### Requirement: Consistent operation semantics
UI and external mutations SHALL enforce the same validation, revisions, and event behavior. Responses MUST use documented status codes and machine-readable error codes. Unknown resources, invalid input, insufficient scope, and stale revisions SHALL be distinguishable. Failed operations MUST NOT emit successful mutation events.

#### Scenario: Same invalid value through either surface
- **WHEN** a browser action or external client writes an unknown select option
- **THEN** the operation fails with the same domain validation code and leaves the item unchanged

#### Scenario: Existing integration after archival
- **WHEN** an external client writes a value to an archived field using its original ID
- **THEN** the server reports an explicit archived-field error without silently dropping or reinterpreting the value

### Requirement: Bounded requests
The API SHALL enforce documented limits on request bytes, string lengths, field counts, page sizes, and authentication attempts. Oversized input MUST be rejected without a partial mutation. Client-controlled property names MUST NOT alter server object prototypes or authorization behavior.

#### Scenario: Oversized request
- **WHEN** a client submits an item body larger than the published limit
- **THEN** the server returns a size or validation error and persists neither an item change nor a success event

### Requirement: Integration documentation
The application SHALL provide an API contract and runnable examples for discovery, scoped item access, rename compatibility, webhook verification, and connecting independently configured instances. Documentation MUST distinguish loopback local HTTP from hosted HTTPS and MUST NOT claim MCP, ACP, or automatic local/cloud synchronization is built in.

#### Scenario: Connect an external script
- **WHEN** an owner follows the documented example using a scoped token
- **THEN** the script discovers the schema, creates an item, and reads it back without a UI-specific endpoint

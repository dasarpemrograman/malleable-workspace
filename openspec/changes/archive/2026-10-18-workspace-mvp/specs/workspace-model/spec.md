# Workspace Model

## Purpose

Let an owner reshape personal information without losing content or changing the identities that integrations use to reference it.

## ADDED Requirements

### Requirement: Minimal offline workspace
The system SHALL initialize one workspace containing one editable item type, no custom fields, and no items in each local or hosted environment. Once dependencies and the owner secret are configured, local reading, editing, and schema customization MUST work without an internet connection or Cloudflare login.

#### Scenario: First offline launch
- **WHEN** the owner starts a fresh instance with networking unavailable
- **THEN** the workspace is usable with an empty item collection and one type
- **AND** local edits do not depend on an external service

### Requirement: Stable resource identity
The system SHALL assign immutable IDs to the workspace, items, types, fields, and select options. Renaming a resource or changing presentation MUST preserve its ID and existing references.

#### Scenario: Existing client survives customization
- **WHEN** an owner renames a type, a field, and a select option used by an item
- **THEN** the item retains its original resource references and values
- **AND** an external client can read and update it using the original IDs

### Requirement: Typed custom values
The system SHALL support text, finite number, checkbox, and single-select fields attached to a type. Custom values MUST be keyed by field ID. Absent values SHALL remain unset. Unknown fields, unknown select options, incompatible values, and changing an existing field's kind MUST be rejected without a partial write.

#### Scenario: Valid custom values
- **WHEN** a client saves values matching the item's active type and field definitions
- **THEN** the values retain their kinds when read back after a restart

#### Scenario: Invalid edit is atomic
- **WHEN** an edit contains one valid value and one value incompatible with its field
- **THEN** the complete edit is rejected and the item remains unchanged

### Requirement: Item lifecycle
The system SHALL support creating, reading, updating, archiving, and restoring items. Each item MUST have a type ID, a title, plain-text body, timestamps, and a revision. Archiving SHALL preserve content and exclude the item from active listings by default.

#### Scenario: Restore an archived item
- **WHEN** an owner archives an item and subsequently restores it
- **THEN** its ID, type, body, and custom values are preserved
- **AND** it reappears in active listings

### Requirement: Non-destructive field archival
The system SHALL support archiving and restoring field definitions without deleting their values. Archived fields MUST remain discoverable with an archived marker and be read-only until restored. Permanent field deletion SHALL be unavailable in the MVP.

#### Scenario: Archived data remains recoverable
- **WHEN** a field holding item values is archived
- **THEN** the normal editor hides it and API reads retain its definition and stored values
- **AND** an attempted write to it is rejected without altering other values
- **AND** restoring the field makes its original values editable again

### Requirement: Conflict detection
The system SHALL require the current revision when updating an existing item or schema resource. A stale update MUST fail as a conflict without overwriting the current version. Successful updates SHALL increment the revision.

#### Scenario: Concurrent UI and API edits
- **WHEN** an API client submits an edit using a revision superseded by a UI edit
- **THEN** the API reports a conflict and preserves the UI edit
- **AND** the client can reload the current revision before retrying

### Requirement: Durable commits
The system SHALL persist accepted content and schema changes across local runtime restarts and hosted object eviction or redeployment using the same namespace. A mutation and its corresponding change event MUST be committed together or neither SHALL become visible.

#### Scenario: Restart after a successful edit
- **WHEN** the server restarts after acknowledging an edit
- **THEN** the edit and its event remain available

#### Scenario: Hosted object eviction
- **WHEN** a hosted workspace object is evicted and later recreated from its persistent storage
- **THEN** acknowledged content, schema, revisions, and events remain available

### Requirement: Portable export and restoration
The owner SHALL be able to export a versioned JSON snapshot containing workspace identity, schema, items, archived content, and saved views. Credentials, sessions, webhook subscriptions, and delivery history MUST be excluded. Restoration SHALL accept only a valid supported snapshot into an instance with no owner-created data and SHALL preserve exported IDs atomically.

#### Scenario: Restore a customized workspace
- **WHEN** the owner restores a valid export into a fresh instance
- **THEN** the exported schema, items, views, values, and IDs replace the fresh defaults
- **AND** restored connections require new credentials and explicit configuration

#### Scenario: Transfer between local and hosted environments
- **WHEN** the owner exports a local workspace and restores it into a pristine hosted instance, or performs the reverse transfer
- **THEN** supported content, schema, views, and IDs are preserved
- **AND** later changes in either environment are not automatically synchronized

#### Scenario: Reject an unsafe restore
- **WHEN** a restore has invalid references, an unsupported format version, or targets an instance with owner-created data
- **THEN** restoration fails without changing existing data

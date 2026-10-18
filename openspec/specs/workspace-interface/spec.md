# workspace-interface Specification

## Purpose

Provide a small browser interface for shaping and using the workspace without requiring code or a predetermined productivity workflow.

## Requirements

### Requirement: Empty starting surface
The interface SHALL open to the owner's active items with an actionable empty state when none exist. It MUST offer item creation and access to schema and connection settings without installing a template or configuring an external service.

#### Scenario: Create the first item
- **WHEN** the owner opens a fresh workspace and chooses to add an item
- **THEN** they can enter a title and body, save, and see that item in the collection

### Requirement: Schema editing through the interface
The owner SHALL be able to add and rename types; add, rename, archive, and restore fields; and add and rename select options. The interface MUST show each field's kind and explain that changing its kind is unavailable. Creating an item SHALL allow selection of an existing type; changing an existing item's type is outside the MVP.

#### Scenario: Shape a research collection
- **WHEN** the owner adds a Research type with a select field named Confidence and three options
- **THEN** new Research items offer that field with the configured options
- **AND** another type's items do not offer the Research fields

### Requirement: Item editing and recovery
The interface SHALL support editing title, plain-text body, and active custom fields, plus item archival and restoration. Validation and save failures MUST remain visible, preserve unsaved input, and not report success. Conflicts SHALL offer reloading the current record without automatically overwriting it.

#### Scenario: Failed save preserves work
- **WHEN** an item save fails validation or conflicts with a concurrent API update
- **THEN** the interface explains the failure and retains the owner's unsaved input

### Requirement: Search and type filtering
The interface SHALL provide case-insensitive search across item titles and bodies and an optional type filter. Search and type filtering MUST work together and distinguish no matches from an empty workspace.

#### Scenario: Narrow a populated collection
- **WHEN** the owner selects a type and enters a search phrase
- **THEN** the interface shows only active items of that type whose title or body contains the phrase

### Requirement: Configurable list and board views
The interface SHALL provide a list view and a board view for a selected type with an active select field. Board columns MUST use option IDs and include unset items. Moving an item between columns SHALL update that field through the normal item operation. A missing or archived grouping field MUST prompt reconfiguration without hiding the underlying items.

#### Scenario: Board survives renamed labels
- **WHEN** the owner groups a board by a select field and later renames the field or an option
- **THEN** the board retains its grouping and displays the new labels

#### Scenario: Move an item on the board
- **WHEN** the owner uses a card's move control to choose another column
- **THEN** the item's selected option changes and the card appears in that column after a successful save

#### Scenario: Grouping becomes unavailable
- **WHEN** a board's grouping field is archived
- **THEN** the interface offers a list fallback and explains how to choose another grouping field

### Requirement: Saved view preferences
The interface SHALL persist view mode, selected type, and board grouping independently of item data. Changing presentation MUST NOT change resource IDs or API contracts.

#### Scenario: Reopen a configured view
- **WHEN** the owner returns to the workspace after a restart
- **THEN** the saved view and grouping are restored when their definitions are still valid

### Requirement: Connection management
The owner SHALL be able to create and revoke scoped API tokens, configure and disable webhook subscriptions, inspect delivery status, and retry failed deliveries. Newly generated secrets MUST be shown only at creation and excluded from subsequent listings. The UI SHALL display the current API base URL and distinguish loopback-only local use from authenticated hosted HTTPS access.

#### Scenario: Configure an external receiver
- **WHEN** the owner registers an eligible HTTPS webhook URL
- **THEN** the interface shows the subscription, provides its signing secret once, and later displays delivery outcomes

#### Scenario: Hosted connection instructions
- **WHEN** the owner opens connection settings on a deployed instance
- **THEN** examples use that instance's HTTPS API URL and require a scoped bearer token
- **AND** the interface does not suggest the local development workspace is synchronized with it

### Requirement: Accessible narrow-screen operation
The core item, schema, and connection flows SHALL work with keyboard controls and at a 360-pixel viewport width. Inputs MUST have accessible names, dialogs MUST manage focus, and loading, success, and failure states MUST be distinguishable without relying only on color.

#### Scenario: Keyboard-only item editing
- **WHEN** the owner navigates by keyboard to create and edit an item
- **THEN** all required controls are reachable, focus remains visible, and the result is announced or visibly described

### Requirement: Owner data recovery controls
The interface SHALL expose snapshot export and restoration with a clear explanation of the empty-instance restriction and excluded connection credentials. Restoration MUST require explicit confirmation before replacing fresh defaults.

#### Scenario: Restore confirmation
- **WHEN** the owner selects a valid snapshot in a fresh instance
- **THEN** the interface describes the replacement and requires confirmation before applying it

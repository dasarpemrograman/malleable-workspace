# Workspace Events

## Purpose

Let a workspace notify independently configured external receivers of durable changes while making delivery failures and duplicate handling explicit.

## ADDED Requirements

### Requirement: Durable event envelope
Every successful item or schema mutation SHALL create a durable event containing immutable event ID, workspace ID, envelope version, event type, resource ID, resource revision, occurrence time, and non-secret actor identity. Events MUST NOT contain credentials. Mutations and events SHALL commit atomically.

#### Scenario: Inbound edit produces an outbound event
- **WHEN** an API client successfully updates an item
- **THEN** a corresponding event identifies that item and its new revision
- **AND** the event identifies the API token by a non-secret ID rather than exposing its secret

### Requirement: Explicit subscriptions
Only the owner SHALL configure or disable subscriptions. A subscription MUST explicitly select item events, schema events, or both and SHALL receive only matching events committed while it is enabled. Disabling it MUST prevent new attempts for queued deliveries; an attempt already in flight may finish.

#### Scenario: Subscribe to selected changes
- **WHEN** the owner enables an item-only subscription and subsequently changes an item and a field name
- **THEN** only the item event is queued for that subscription

### Requirement: Eligible receiver destinations
Webhook delivery SHALL accept only owner-configured HTTPS URLs on an operator's exact-host allowlist with valid TLS. IP literals, localhost names, URL credentials, non-443 ports, and redirects MUST be rejected. Hosted delivery MUST use Workers public fetch routing without private-network bindings or origin overrides. Local delivery SHALL target only operator-trusted hostnames; DNS/IP pinning is not guaranteed by this contract.

#### Scenario: Reject an ineligible destination
- **WHEN** the owner supplies an IP-literal URL, a localhost name, or a hostname outside the configured allowlist
- **THEN** registration or delivery fails visibly before an outbound request is issued

#### Scenario: Allowlist changes after subscription creation
- **WHEN** an operator removes a receiver hostname from the allowlist before the next attempt
- **THEN** the next attempt is blocked without contacting that receiver

#### Scenario: Receiver redirects to another service
- **WHEN** a receiver returns a redirect
- **THEN** delivery records a failure and does not request the redirect destination

### Requirement: Verifiable delivery
The system SHALL POST an event as JSON with an event ID, attempt timestamp, and HMAC-SHA256 signature over the timestamp and exact request-body bytes using a subscription-specific secret. Retries MUST preserve event ID and payload while signing a new attempt timestamp. The secret SHALL be disclosed to the owner only at subscription creation.

#### Scenario: Receiver verifies a message
- **WHEN** a receiver recomputes the signature with the issued secret and exact received bytes
- **THEN** a valid delivery verifies and a modified body fails verification

### Requirement: Bounded retry and durable delivery state
Delivery SHALL treat only HTTP 2xx as success. Each delivery cycle SHALL have at most three reserved attempts with increasing delays and a timeout per attempt. Pending work MUST survive local restarts and hosted eviction. Alarm retries MUST NOT reset delivery budgets. Delivery can duplicate; receivers MUST deduplicate by workspace ID and event ID, and ordering MUST NOT be guaranteed.

#### Scenario: Temporary receiver failure
- **WHEN** a receiver fails an attempt and later succeeds within the retry budget
- **THEN** delivery becomes successful and no further retry is scheduled for that cycle

#### Scenario: Retry budget exhausted
- **WHEN** all three attempts fail
- **THEN** the delivery becomes failed and no automatic attempts continue until the owner explicitly retries it

#### Scenario: Restart around receiver acknowledgement
- **WHEN** the server restarts after a receiver accepted a request but before success was recorded locally
- **THEN** redelivery can occur with the same event ID so the receiver can deduplicate it

#### Scenario: Duplicate alarm invocation
- **WHEN** the runtime repeats an alarm handler after an interrupted delivery attempt
- **THEN** durable attempt state prevents a fourth automatic request in the same cycle
- **AND** exhausted or disabled deliveries are not sent again

### Requirement: Delivery observability and manual retry
The owner SHALL be able to inspect event ID, destination, attempt count, timestamps, HTTP outcome or failure reason, and pending/succeeded/failed state. They SHALL be able to start a new bounded retry cycle for a failed delivery on an enabled subscription. Logs and responses MUST not expose signing secrets or authorization credentials.

#### Scenario: Recover a failed delivery
- **WHEN** the owner retries a failed delivery after repairing the receiver
- **THEN** a new bounded cycle sends the original event ID and payload and updates its visible outcome

### Requirement: Non-blocking external delivery
An unavailable receiver SHALL NOT prevent local editing or roll back an accepted workspace mutation. Delivery MUST run outside the mutation response path with bounded concurrency and request timeouts.

#### Scenario: Offline local editing
- **WHEN** the owner edits an item while the receiver is unreachable
- **THEN** the edit succeeds locally and its queued delivery later succeeds or visibly exhausts its retry budget

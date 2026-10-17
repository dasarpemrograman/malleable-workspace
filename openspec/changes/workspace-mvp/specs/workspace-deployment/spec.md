# Workspace Deployment

## Purpose

Make the same personal workspace straightforward to deploy into an owner's Cloudflare account and usable locally without connecting to hosted data.

## ADDED Requirements

### Requirement: Single Workers application
The system SHALL serve the browser UI and versioned API through one Workers application using a SQLite-backed Durable Object for workspace state. Local and hosted operation MUST use the same Worker entry point, domain rules, and binding interfaces. Neither mode SHALL require a standalone Node application server, native SQLite module, or external database service.

#### Scenario: Build for both execution modes
- **WHEN** a contributor builds the application
- **THEN** the resulting application can execute locally in the Workers runtime and deploy to Workers without replacing its backend
- **AND** UI assets and API routes are served from one origin in either mode

### Requirement: Deploy to Cloudflare entry point
The template SHALL provide a Deploy to Cloudflare button targeting its real public GitHub or GitLab source, build/deploy scripts, declared bindings, and a SQLite Durable Object class migration. The guided flow SHALL support a user-selected Worker name, provision the required namespace, and request the owner secret. Template instructions MUST disclose account requirements and platform usage limits.

#### Scenario: Fresh-account deployment
- **WHEN** a user follows the button from the published template and supplies required configuration in an eligible Cloudflare account
- **THEN** the application builds and deploys with its Durable Object binding without requiring manual database creation
- **AND** the resulting HTTPS origin presents owner login before revealing workspace content

#### Scenario: Template repository is not yet published
- **WHEN** no public source repository is available for the button
- **THEN** documentation marks the button flow unavailable or unverified rather than presenting a placeholder link as working

### Requirement: Secret-aware startup
Hosted deployments SHALL receive the owner key through a Worker secret; local execution SHALL read an ignored local secrets file. Example files MUST contain non-working placeholders and describe required values. Protected routes MUST fail closed for missing or invalid configuration. No default secret or unauthenticated first-visitor ownership claim SHALL exist.

#### Scenario: Local bootstrap
- **WHEN** a user runs the documented local setup command on a clean checkout
- **THEN** it creates a cryptographically random owner key in an ignored local file without Cloudflare login
- **AND** it does not print or commit the key in ordinary logs

### Requirement: Fully local development
After dependencies are installed and local configuration exists, the documented development command SHALL run Worker code and simulated Durable Object storage locally without Cloudflare credentials, login, or remote bindings. Local item/schema operations MUST remain usable offline. Outbound webhooks SHALL require connectivity to their explicitly configured receivers.

#### Scenario: Local operation without a Cloudflare account
- **WHEN** a user starts local development without Cloudflare credentials or network connectivity
- **THEN** they can log in, create and customize items, and read them through the local API
- **AND** no workspace operation reads or modifies a hosted resource

### Requirement: Persistent isolated local state
The default local command SHALL bind to loopback and persist state in a documented ignored directory. Restarting with that directory MUST retain data and workspace identity. Separate local persistence directories and hosted namespaces MUST remain isolated. Normal development and deployment SHALL NOT upload local state or local secrets.

#### Scenario: Restart local development
- **WHEN** a user stops and restarts the local runtime with the same persistence directory
- **THEN** saved items, schema, views, tokens, and queued delivery state remain available

#### Scenario: Deployment does not copy development data
- **WHEN** a user deploys after working locally
- **THEN** the hosted namespace does not receive local content, tokens, subscriptions, or owner credentials

### Requirement: Environment-neutral transfer
The same supported export format SHALL restore into a pristine local or hosted instance without provider-specific database copying. It MUST preserve content identities while excluding source credentials and subscriptions. The transfer flow MUST explain that it creates no ongoing synchronization and that an identity-preserving replacement should retire the source instance.

#### Scenario: Move a workspace to Workers
- **WHEN** the owner exports a local workspace and restores it into a pristine hosted instance
- **THEN** API references using exported IDs still identify the restored resources
- **AND** the destination uses its own owner secret and requires newly configured connections

### Requirement: Safe application upgrades
Redeploying to the same Durable Object namespace SHALL preserve state and queued deliveries. Application schema migrations MUST be versioned and atomic. Documentation SHALL distinguish application migrations from Durable Object class migrations and explain rollback limits and portable recovery. A deployment MUST NOT silently switch to a new empty namespace or reset data.

#### Scenario: Redeploy an existing workspace
- **WHEN** a compatible build is deployed using the existing binding and namespace
- **THEN** the next authenticated read returns the previous workspace ID and content
- **AND** pending deliveries continue subject to their existing budgets

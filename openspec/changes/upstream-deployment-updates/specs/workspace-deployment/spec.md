# Workspace Deployment Delta

## MODIFIED Requirements

### Requirement: Safe application upgrades

Redeploying to the same Durable Object namespace SHALL preserve state and queued deliveries. Application schema migrations MUST be versioned and atomic. Documentation SHALL distinguish application migrations from Durable Object class migrations and explain rollback limits and portable recovery. A deployment MUST NOT silently switch to a new empty namespace or reset data.

#### Scenario: Redeploy an existing workspace

- **WHEN** a compatible build is deployed using the existing binding and namespace
- **THEN** the next authenticated read returns the previous workspace ID and content
- **AND** pending deliveries continue subject to their existing budgets

#### Scenario: Apply an upstream update to an existing instance

- **WHEN** the owner promotes a compatible upstream update to the existing Worker
- **THEN** item/schema identities, custom values, token revocation and configured connections remain valid
- **AND** changing application code does not copy local development data or initialize a replacement workspace

#### Scenario: Recover from an incompatible update

- **WHEN** an application update requires data changes incompatible with an earlier build
- **THEN** the operator instructions distinguish code rollback from explicit snapshot or checkpoint recovery
- **AND** do not promise that redeploying old code reverses the data migration

## ADDED Requirements

### Requirement: Explicit upgrade destination

An upgrade SHALL identify its expected Worker and existing storage binding before deployment. Conflicting destination settings, unsupported binding changes or missing identity information MUST stop the upgrade before upload. Normal upstream import MUST NOT replace established class-migration history or authorize namespace deletion.

#### Scenario: Upstream defaults differ from the deployed name

- **WHEN** a template copy named male2 imports an update whose upstream default Worker name differs
- **THEN** its upgrade targets male2 with the established binding
- **AND** it does not create or deploy to the upstream default Worker

#### Scenario: Deployment settings disagree

- **WHEN** the build provider or deployment command selects a different Worker from the instance's expected destination
- **THEN** the upgrade fails with a destination mismatch before any upload

#### Scenario: Update would replace storage identity

- **WHEN** an update removes a recorded migration, changes the established workspace class/binding, or requests namespace deletion
- **THEN** the routine updater blocks promotion and identifies the required separate migration review

### Requirement: Retained instance deployment configuration

Compatible upgrades SHALL retain existing Worker secrets and provider-managed instance variables unless the owner explicitly changes them. Default values from the original repository MUST NOT overwrite an existing receiver allowlist. Initial deployments MUST still fail closed without an owner secret and use an empty receiver allowlist when none is configured.

#### Scenario: Preserve dashboard settings during an update

- **WHEN** the owner configured an owner secret and receiver allowlist in Cloudflare before importing upstream changes
- **THEN** redeployment keeps those values and webhook subscriptions remain usable
- **AND** the upgrade does not copy secrets into Git or application assets

#### Scenario: Deploy a new copy

- **WHEN** a fresh template deployment has no owner secret or configured receiver allowlist
- **THEN** protected content remains inaccessible and outbound receiver registration remains unavailable until configured

### Requirement: Validated production promotion

Only the owner's promotion to the connected production branch or an explicit equivalent operator deployment SHALL initiate a production upgrade. Required candidate and build checks MUST finish before upload. Documentation MUST explain the Git-provider connection, production branch, build commands and preview isolation needed to update the existing Worker.

#### Scenario: Review without production effects

- **WHEN** an upstream update PR is opened or tested
- **THEN** production code, secrets and storage remain unchanged
- **AND** any preview execution uses isolated bindings or remains disabled

#### Scenario: Deploy a merged update

- **WHEN** the owner merges an accepted update into the configured production branch with functioning Workers Builds integration
- **THEN** successful required build checks are followed by deployment to the existing Worker
- **AND** the owner can identify the repository commit, build outcome and active Worker version

#### Scenario: Build fails before upload

- **WHEN** validation or asset/Worker compilation fails for a promoted commit
- **THEN** that build does not upload the candidate or change the active production version
- **AND** the failure is reported with a recovery or retry path

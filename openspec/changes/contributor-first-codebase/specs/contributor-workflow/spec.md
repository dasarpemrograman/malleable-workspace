# Contributor Workflow

## Purpose

Let contributors set up an isolated workspace, locate the relevant code, validate a focused change and submit it for review through predictable local and hosted feedback.

## ADDED Requirements

### Requirement: Discoverable contribution path

The repository SHALL link its contributor guide from the main README. The guide MUST document prerequisites, clean-checkout setup, local sign-in, test selection, browser provisioning and common setup failures without requiring production access.

#### Scenario: Start from a clean checkout

- **WHEN** a contributor follows the guide with the supported toolchain and install-time connectivity
- **THEN** they can install dependencies, create private local configuration and open a usable local workspace
- **AND** no Cloudflare login, production key or deployed namespace is required

#### Scenario: Prerequisite is missing

- **WHEN** the contributor lacks a supported runtime or browser executable
- **THEN** the documented checks identify the missing prerequisite and give a concrete setup command or supported override
- **AND** the workflow does not report an unexecuted check as passed

### Requirement: Automatic local edit feedback

The documented development command SHALL rebuild changed client assets and reload changed Worker code without a manual command restart. Development MUST remain on loopback with one application origin and retain the existing local workspace across edits and restarts.

#### Scenario: Edit frontend or backend code

- **WHEN** a contributor saves a valid frontend or Worker change during a development session
- **THEN** the change becomes observable after the relevant rebuild and a browser refresh without restarting development
- **AND** existing workspace content and owner access are retained

#### Scenario: Recover from a compilation error

- **WHEN** a source edit fails compilation and the contributor then corrects it
- **THEN** the error is visible in development output and a subsequent successful rebuild serves the correction
- **AND** the workflow does not reset workspace storage to recover

#### Scenario: Stop or fail the development command

- **WHEN** the contributor stops development or a required child process terminates unexpectedly
- **THEN** associated watchers and local servers are stopped and their ports released
- **AND** unexpected termination produces a failure exit status without deleting local data

### Requirement: Independently runnable validation suites

Contributors SHALL be able to run contract, runtime and operator tests independently with their required artifacts prepared automatically. The documented aggregate command MUST include all three suites; focused test selection MUST NOT silently omit tests from the aggregate or existing deployment validation.

#### Scenario: Validate one area from a clean checkout

- **WHEN** a contributor runs a documented focused suite after dependency installation without prebuilt artifacts
- **THEN** its prerequisites are prepared and only the selected suite runs
- **AND** failures retain their diagnostic output and return a nonzero exit status

#### Scenario: Run complete validation

- **WHEN** a contributor runs the aggregate check command
- **THEN** formatting, type, packaging, contract, runtime and operator failures cause it to fail
- **AND** browser acceptance remains an explicit documented check included in pull-request validation

### Requirement: Non-mutating quality feedback

The repository SHALL provide a formatting check that reports actionable file paths without rewriting tracked files. Formatting fixes MUST be a separate explicit command. Quality commands MUST exclude generated outputs, installed dependencies, local secrets and workspace state.

#### Scenario: Check an incorrectly formatted edit

- **WHEN** a contributor runs the formatting check on an incorrectly formatted maintained source file
- **THEN** it reports the file and exits unsuccessfully without modifying it
- **AND** the guide identifies the command that applies the fix

#### Scenario: Validate with existing local data

- **WHEN** formatting or automated validation runs beside an existing local workspace
- **THEN** it neither formats nor deletes that workspace's secrets, exports or persistent state
- **AND** disposable test state remains isolated from development state

### Requirement: Safe pull-request validation

Ordinary pull requests and default-branch pushes SHALL receive stable, documented validation checks that use the same local commands. Executing contribution code MUST NOT receive production secrets, deployment credentials or repository-write authority, and MUST NOT deploy. Missing approval or skipped execution MUST remain distinguishable from success.

#### Scenario: Validate an external contribution

- **WHEN** an authorized pull-request validation run executes code from an external contribution
- **THEN** the core checks and browser journey run with isolated test configuration and no deployment or repository-write credentials
- **AND** results identify failing commands through stable check names

#### Scenario: Repository policy requires approval

- **WHEN** GitHub requires a maintainer to approve a contribution workflow
- **THEN** the contribution guide explains that action and how to inspect the checks afterward
- **AND** no pending, skipped or absent check is described as passed

#### Scenario: Review automation-created updates

- **WHEN** an upstream-update PR does not trigger ordinary PR checks because of GitHub token policy
- **THEN** the guide distinguishes updater results from ordinary PR validation and documents an explicit trusted way to request the latter
- **AND** it does not advise granting production secrets or bypassing required review

### Requirement: Change navigation and contract preservation

Contributor documentation SHALL map common UI, schema, API, delivery and deployment changes to their code and verification boundaries. Structural changes MUST preserve the existing published application contracts, storage identity and security behavior, verified through the relevant existing regression suites.

#### Scenario: Locate a small change

- **WHEN** a contributor uses the architecture guide to change a UI component or outbound delivery behavior
- **THEN** the guide identifies the responsible module, dependency boundary and focused checks
- **AND** it explains which public contracts require explicit specification changes

#### Scenario: Preserve inbound clients across refactoring

- **WHEN** the reorganized app receives an authenticated existing API request using retained item or schema IDs
- **THEN** response, authorization, validation and conflict behavior remain compatible with the existing contract
- **AND** existing data, token revocation and snapshot semantics remain valid

#### Scenario: Preserve outbound connections across refactoring

- **WHEN** a pre-existing subscription has pending work and the reorganized delivery implementation runs
- **THEN** signing, event identity, retry budgets and revocation or disable behavior retain their existing semantics
- **AND** code reorganization does not recreate storage or reset delivery state

### Requirement: Clear contribution conventions

The contributor guide SHALL describe the project's Scoped Commits format with area-based examples, the expected change/test evidence in a PR and when OpenSpec planning is appropriate. Guidance MUST distinguish preparing a proposal from authorization to apply it and MUST describe the current implemented architecture.

#### Scenario: Submit a contribution

- **WHEN** a contributor prepares a commit and pull request using the documented conventions
- **THEN** they can use an area-based `scope: description` subject and provide the problem, resulting behavior and relevant validation evidence
- **AND** small fixes do not require invented specification changes or mandatory local hooks

#### Scenario: Plan a contract-changing contribution

- **WHEN** a contributor proposes a change to observable behavior or a published integration contract
- **THEN** the guide identifies the applicable specifications and planning workflow
- **AND** proposal creation alone does not start implementation or authorize deployment

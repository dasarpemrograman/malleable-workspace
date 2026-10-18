# Workspace Updates

## Purpose

Let owners of independent deployed copies review and import changes from the original project while retaining their own application customizations and deployment identity.

## ADDED Requirements

### Requirement: Explicit upstream tracking

The update tools SHALL record the trusted source repository, tracking ref and last imported immutable upstream commit in owner-controlled repository metadata. Each check MUST resolve the requested ref to a fixed target commit before preparing changes. Imported source revision and successfully deployed revision MUST remain distinguishable.

#### Scenario: Prepare a pinned update

- **WHEN** the owner checks for updates and the upstream branch advances during preparation
- **THEN** the candidate and its review summary use the target commit resolved at the start
- **AND** the candidate records that commit as its imported baseline without claiming it is already deployed

#### Scenario: No new changes

- **WHEN** the selected target equals the recorded imported commit
- **THEN** the updater reports the copy is current without creating an empty PR or starting a deployment

### Requirement: Bootstrap independent template copies

Owners SHALL be able to initialize update tracking for a template copy without shared Git history or preinstalled update workflows. Bootstrap MUST preserve the downstream default branch and create a reviewable candidate. It MUST use an explicitly selected baseline or a unique content-verified match; ambiguous or missing baselines MUST stop with instructions.

#### Scenario: Update an old deployed template copy

- **WHEN** an owner bootstraps a standalone copy whose only initial differences are its package and Worker names
- **THEN** the tools identify a unique matching upstream baseline or require the owner to supply it
- **AND** prepare the updater installation and upstream changes in a branch without requiring a fork conversion

#### Scenario: Baseline cannot be established

- **WHEN** multiple upstream commits match or local changes prevent a unique baseline match
- **THEN** bootstrap requests an explicit upstream commit and changes neither the default branch nor the live Worker

### Requirement: Reviewable upstream changes

An explicit owner action SHALL prepare an update branch and pull request in the downstream repository containing the changes from the imported baseline to the selected target. The workflow MUST NOT merge the PR or deploy production. Repeated checks for the same target MUST reuse an existing open update PR or report its location rather than create duplicates.

#### Scenario: Prepare an update PR

- **WHEN** new upstream changes can be applied
- **THEN** the owner receives a PR identifying source repository, baseline, target, changed files and validation results
- **AND** the downstream production branch and deployed application remain unchanged until owner promotion

#### Scenario: Repeat an update check

- **WHEN** an open update PR already targets the selected upstream commit
- **THEN** the updater returns that PR without rewriting its commits or creating another PR

### Requirement: Preserve customizations and expose conflicts

Update preparation SHALL preserve downstream customizations and instance-specific names while importing non-conflicting upstream changes. A conflict MUST identify affected paths and stop automatic preparation without committing conflict markers, resetting owner branches or silently selecting either side. Unrelated upstream history MUST require explicit baseline recovery.

#### Scenario: Preserve a customized deployment

- **WHEN** an upstream update changes application files and the copy has a custom Worker name, package name and unrelated UI edit
- **THEN** the candidate retains those customizations while importing the compatible changes

#### Scenario: Conflicting application edit

- **WHEN** upstream and downstream change the same behavior incompatibly
- **THEN** preparation reports conflicting paths and leaves the live deployment and owner's branches unchanged

#### Scenario: Upstream history was replaced

- **WHEN** the recorded baseline cannot be fetched or is not an ancestor of the selected target
- **THEN** the updater stops for an explicit reviewed rebaseline rather than treating the repository as a fresh install

### Requirement: Candidate validation and migration disclosure

An update candidate SHALL be checked with the project's dependency, type, build and automated contract checks before being reported ready for owner review. Its summary MUST identify dependency, workflow and migration changes. Failed checks MUST remain visible and MUST NOT be represented as passed, merged or deployed.

#### Scenario: Candidate fails validation

- **WHEN** an upstream dependency or code change fails the candidate checks
- **THEN** the owner receives the failing check and run details
- **AND** the updater does not report a successful upgrade or invoke production deployment

#### Scenario: Candidate changes migrations

- **WHEN** the candidate adds migrations or changes binding declarations
- **THEN** its PR explicitly identifies those changes and any blocked identity changes before owner review

### Requirement: Separated repository and deployment credentials

Preparing updates SHALL require only the repository access needed for the requested branch and PR operations. Candidate execution MUST NOT receive production application secrets or Cloudflare deployment credentials. The deployed application MUST NOT store update credentials or execute repository deployment commands.

#### Scenario: Build an unmerged update

- **WHEN** candidate installation and tests execute
- **THEN** the job has no production owner key, webhook signing secret or Cloudflare deployment token
- **AND** repository write credentials are excluded from candidate command execution

### Requirement: Actionable update outcomes

The update procedure SHALL distinguish current, candidate prepared, conflict, validation failed, deployment pending, deployment failed and deployed outcomes. It MUST show the available PR, validation run and Cloudflare build/version references. Missing repository permissions or build integration MUST produce setup instructions rather than a success claim.

#### Scenario: Merge succeeds but deployment fails

- **WHEN** an owner merges an update and its Cloudflare build fails
- **THEN** the procedure identifies the imported repository revision and the failed deployment separately
- **AND** it directs the owner to the failed build and recovery instructions without claiming the new revision is live

#### Scenario: GitHub requires workflow approval

- **WHEN** an automation-created PR requires approval before its normal CI runs
- **THEN** the update summary distinguishes completed updater checks from pending PR checks
- **AND** explains the required owner action without claiming those checks passed

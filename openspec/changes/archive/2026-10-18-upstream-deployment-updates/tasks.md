# Tasks

Implementation in progress under the apply request. The existing `male2`
repository and Worker are not used as deployment acceptance targets.

## 1. Provenance, import and bootstrap

- [x] 1.1 Add versioned owner-created upstream/deployment metadata with strict source/ref/SHA and identity validation; verify malformed records, missing identities, unavailable baselines, non-ancestral targets and canonical-repository self-updates produce explicit failures/no-ops without changing a downstream branch.
- [x] 1.2 Implement pinned baseline-to-target three-way import in a clean temporary clone/worktree, normalizing only the documented name fields and preserving owner metadata; verify an unrelated-history template fixture, ordinary forks, binary files, renames/deletions, non-conflicting customizations, conflicting edits, migration-history changes and dirty owner checkouts with isolated Git tests.
- [x] 1.3 Implement bootstrap from a reviewed upstream checkout, supporting explicit or uniquely content-matched baselines and a reviewable first candidate; verify the observed `male2`-style fixture matches `0ecb595...` after only package/Worker-name normalization, ambiguous matches stop, and no fork conversion/default-branch reset is required.
- [x] 1.4 Document bootstrap, metadata meanings, source-versus-deployed revisions and conflict/rebaseline procedures; exercise the documented commands against a fresh template-style local repository and verify they preserve its names and original branch until explicit promotion.

## 2. Owner-triggered GitHub update PRs

- [x] 2.1 Add the manual Prepare upstream update workflow and CLI PR publication path, serializing checks and reusing an open PR for the same target without force-resetting it; verify duplicate/no-change runs, missing PR permissions, a stale existing PR and source-ref movement using isolated GitHub API fixtures.
- [x] 2.2 Separate candidate preparation, unprivileged install/type/build/runtime/browser validation and trusted PR publication; pin Actions, remove persisted write credentials from candidate checkouts, and verify no production secrets/deploy tokens/write credentials enter candidate commands or failure logs.
- [x] 2.3 Include immutable baseline/target, changed files, migration/binding/dependency/workflow changes and exact validation outcomes in the PR/run summary; verify failed candidates remain failed/draft and pending normal PR workflow approvals are never shown as passed.
- [x] 2.4 Document GitHub Actions PR settings, local authenticated CLI fallback, workflow-approval behavior and the review/merge steps; verify the instructions against a disposable downstream GitHub repository with an unrelated initial history and record a real update PR without automatically merging it.

## 3. Guarded deployment to an existing Worker

- [x] 3.1 Add a shared deployment wrapper and package command integration supporting initial template setup and enrolled upgrades; verify resolved paths, Node/toolchain checks, deploy-button script discovery and ordinary credential-free local development remain correct through fixtures and dry runs.
- [x] 3.2 Enforce expected account/Worker/class/binding/namespace/object identity and append-only migration history before upload, including agreement with `WRANGLER_CI_OVERRIDE_NAME`; verify missing preflight access, mismatched CI override, changed namespace/class, removed migration and deletion requests block upload while additive compatible migrations are disclosed.
- [x] 3.3 Generate the upgrade configuration without provider-managed vars and retain them with keep-vars behavior, leaving Worker secrets private; verify a non-empty dashboard allowlist survives an upstream empty default, required new configuration is disclosed, unresolved repository/provider drift stops, and fresh missing-secret/empty-allowlist behavior remains fail-closed.
- [x] 3.4 Document Workers Builds connection to the downstream production branch, required Node/build/deploy settings, disabled or isolated previews, configuration migration and build/deploy failure recovery; verify command fixtures leave upload uncalled on failing checks and the guide distinguishes code rollback from snapshot/PITR recovery.

## 4. Cross-system acceptance

- [x] 4.1 On an authorized disposable downstream repository and Worker, bootstrap and prepare a PR, perform explicit test-owner promotion, and verify Workers Builds deploys that source commit to the same origin/namespace after required checks; record build/Worker-version references and distinguish template history from the newly executed update flow.
- [x] 4.2 Before/after that live update, verify package/Worker names, owner access, instance variables, workspace/item/schema IDs, values, archived data, token revocation and pending signed deliveries are retained; exercise a failing pre-upload build plus the documented compatible rollback/recovery procedure without using `male2` as an unreviewed test target.
- [x] 4.3 Run strict OpenSpec validation, appropriate Git/workflow/deployment tests and the existing app checks; publish sanitized acceptance evidence, delete only disposable repositories/Workers/namespaces, and leave live tasks incomplete when required external access or evidence is unavailable.

## Workflow follow-up

- Review this proposal before running the apply workflow.
- Verify the implementation and actual downstream-to-Cloudflare update journey
  before archiving; a prepared PR or successful dry run is not a deployed update.

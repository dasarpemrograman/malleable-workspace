# Design

## Context

See `proposal.md` for scope and the two delta specs for observable requirements.
The archived MVP and current source establish the existing Workers/React/SQLite
Durable Object architecture; the old setup context in `openspec/config.yaml`
predates that implementation and is not a reason to choose another stack.

The original repository has `npm run deploy` running a build plus `wrangler deploy`,
one `Workspace` class, the `WORKSPACE` binding, migration `v1`, and routing to
`getByName("primary")`. There is no `.github/` automation, upstream provenance
metadata or upgrade wrapper. `wrangler.jsonc` currently declares the default
Worker name and `WEBHOOK_ALLOWED_HOSTS: "[]"`. Ordinary redeployments can therefore
overwrite a dashboard-managed allowlist even though Worker secrets are retained.

Read-only GitHub inspection found that `dasarpemrograman/male2` is a standalone
repository with initial commit `9ffb95f` and no fork parent. Its closest upstream
tree is `0ecb5950e9349de6d6e6714ddacca1e193b4eb5b`: only `package.json` and
`wrangler.jsonc` differ, and the semantic differences are their `name` fields,
both set to `male2`. This gives this instance a content-verifiable initial
baseline; package version `0.1.0` alone would not establish that baseline.

Cloudflare's deploy button clones/customizes the repository and uses Workers
Builds. It does not maintain an upstream merge relationship. Workers Builds
deploys pushes to its configured production branch; preview/version URLs must
not be assumed to give this Durable Object app isolated resources.

## Goals / Non-Goals

**Goals:** one repeatable update path for template copies and forks; reviewable
source changes; explicit instance identity; preservation of owner data and
configuration; useful failures; no new application runtime service.

**Non-Goals:** in-app Git operations, unattended merge/deploy, periodic checks,
GitLab automation, changing data/API contracts, or provider-independent hosting.
Local updates remain supported through the same Git import tooling, with no
Cloudflare calls required until an owner chooses hosted deployment.

## Decisions

### 1. Separate import, review and deployment

Use `scripts/upstream-update.mjs` as the shared CLI for a manual GitHub Actions
workflow and local use. The proposed workflow appears as **Prepare upstream
update** in the downstream repository's Actions tab. The upstream repository
itself detects self-update and reports a no-op.

The updater resolves upstream `main` to an immutable target SHA, creates an
update candidate, validates it and publishes a PR. It never merges. The owner's
merge into the repository's connected production branch starts Workers Builds;
the build validates again before the guarded deploy command uploads anything.
Review/import/deploy are different outcomes and have distinct revision IDs.

An open PR for the same target is reused and its location returned. Concurrency
is serialized per downstream repository. An existing PR branch is not force
reset; stale/conflicting candidates are handled explicitly by the owner.

**Alternative:** scheduled automatic merges hide compatibility decisions and add
background credentials/operations the MVP does not need. A runtime update button
would put repository/deployment authority into the personal-data application.

### 2. Import the upstream delta with a verified baseline

Create owner-controlled `.workspace/upstream.json` with a format version,
trusted GitHub repository, tracking ref and imported upstream SHA. The file is
created after a copy is enrolled, not prefilled with a self-referential upstream
commit in the original template. An upstream commit cannot reliably embed its
own final SHA in a tracked file.

Use a clean temporary clone/worktree of the downstream production branch. Fetch
the pinned baseline/target objects from the configured public upstream. Require
the baseline to be available and ancestral to the target. Generate a full-index
binary Git diff and apply it with three-way semantics; this imports changes even
when downstream history consists of a separate source-import commit. Preserve
renames, deletions, file modes and owner changes. Stop on conflicts; never publish
conflict markers, reset the owner's checkout or force push the default branch.

Treat only `package.json.name`, `wrangler.jsonc.name`, and owner-created tracking/
deployment metadata as explicitly instance-owned. Normalize the two name fields
to the downstream values in temporary baseline/target trees before producing the
patch. Do not exclude whole application/configuration files: new build scripts,
bindings, dependencies and compatibility flags must remain reviewable changes.
All other competing edits require an ordinary merge or an explicit conflict.

Advance the imported SHA in the candidate only after preparation succeeds. It
becomes the repository baseline when that candidate is merged, even if a later
Cloudflare build fails. Do not conflate it with the active deployed revision.

**Alternative:** `git pull upstream main --allow-unrelated-histories` creates an
unhelpful first merge for a template import. Copying upstream files wholesale
discards customizations. Package version/timestamps are not unique provenance.

### 3. Make first-time enrollment explicit

An old copy cannot run a workflow it has not imported yet. Provide a local
bootstrap path run from a reviewed checkout of the new upstream tooling against
the downstream repository. It prepares the first PR installing the updater and
tracking metadata; it does not edit the live Worker or merge its own PR.

Bootstrap accepts an explicit baseline or matches canonical file/blob contents
across upstream history while normalizing only the documented instance-owned
name fields. Require exactly one match; otherwise request a full baseline SHA.
For the currently inspected `male2`, use the verified `0ecb595...` baseline and
retain the `male2` names. Do not assume every downstream has that same history.
New template copies can use the same enrollment through their already-copied
workflow once the workflow is available on the default branch.

Create `.workspace/deployment.json` for an existing hosted instance. Record its
expected account, Worker name, binding/class, namespace ID, fixed object name and
existing class-migration history. These IDs are not credentials. Obtain them
through the owner's authenticated Cloudflare tools or explicit dashboard values;
do not guess from an application URL or silently select the first account.
The GitHub updater needs only this non-secret enrollment record, not Cloudflare
credentials. Local-only copies can defer hosted enrollment.

Document the prerequisite settings: GitHub Actions allowed to create PRs, an
appropriate authenticated Git/GitHub CLI for bootstrap, and Workers Builds
connected to the downstream repository/production branch. Missing permissions
produce instructions; do not try to broaden app permissions automatically.

### 4. Keep candidate validation separate from repository write authority

Use isolated jobs/stages for preparing the candidate, executing its dependency/
type/build/runtime checks, and publishing the PR. Candidate commands run without
production secrets, Cloudflare credentials or repository-write credentials.
Checkout must not persist write credentials into the candidate workspace.
Resolve dependency lockfiles and pin external Actions to reviewed immutable
commits. Do not run candidate code under `pull_request_target` with privileged
credentials.

Validate using the existing `npm ci`, typecheck and `npm test` paths; the latter
already builds client/Worker assets and exercises local runtime contracts.
Include the existing browser checks in repository CI once the runner's Chromium
setup is configured. A failed candidate is reported as failed or a draft PR,
never ready/deployed. Show migration, binding, dependency and workflow changes
prominently in the review summary.

The updater publishes its own run results and link. Do not assume that bot-created
PRs get immediately running required checks: GitHub may require **Approve
workflows to run**, and repository policy can differ. Normal PR checks remain
separate and must not be reported as passed merely because the updater finished.
No personal access token with broad account access is an MVP prerequisite.

**Alternative:** one job checking out and executing candidate scripts with a
write token or Cloudflare secrets would give unreviewed changes those credentials.

### 5. Guard upgrades and preserve provider-managed settings

Add a shared deployment wrapper and update package deployment scripts during
implementation. Preserve the existing initial-template path when hosted
enrollment is absent; enrolled updates use the guarded path. Local development
continues using the existing configuration and simulated bindings.

For an enrolled update, resolve the target from owner metadata and inspect the
existing Worker/binding through the deployment provider before upload. Verify
account, Worker, namespace, class/binding and `primary` routing. The provider's
`WRANGLER_CI_OVERRIDE_NAME` must agree with the enrolled Worker; it takes precedence
in Wrangler and cannot be counteracted safely by a name flag alone. Missing
preflight access or mismatched identity fails closed before uploading.

Generate a temporary deployment configuration with paths resolved relative to
the repository, explicit enrolled Worker/account, append-only class migrations,
and retained bindings. Normal updates cannot change/delete the enrolled class,
binding, namespace or existing migration history. Such a change requires a
separate migration plan rather than an updater escape hatch.

For upgrade mode, omit provider-managed instance `vars` from the generated
configuration and use Wrangler's keep-vars behavior. Merely adding `--keep-vars`
while continuing to send upstream `WEBHOOK_ALLOWED_HOSTS: "[]"` is insufficient:
explicit supplied values can overwrite existing values. Existing variables stay
under the provider's control; new required variables must be disclosed for owner
configuration rather than silently filled from upstream defaults. Secrets remain
provider secrets and are never read into Git metadata or build artifacts.
For a fresh deployment, missing allowlist naturally means empty and missing owner
secret remains fail-closed. Explain the transition for owners who previously
managed their allowlist in the repository: set the intended value in Cloudflare
before switching to upgrade mode, with preflight detecting unresolved differences.

Configure the downstream Workers Builds deploy command to use this wrapper with
the repository's Node 24 toolchain and checks before upload. Preserve support for
the deploy button's initial build/deploy script discovery. Disable automatic
non-production/PR preview deployment for enrolled instances unless owners supply
explicitly isolated resources; neither a preview branch nor a version URL proves
Durable Object state isolation.

**Alternative:** redeploying the original template to a new Worker loses the
existing namespace association. Editing the upstream default name to `male2`
would break the reusable template and other owners' deployments.

### 6. Report failures and test recovery without touching production

The update PR/run identifies imported SHAs, downstream commit, changed settings/
migrations, validation outcomes and the documented Cloudflare Builds location.
After merge, the owner verifies the build's source commit and active Worker
version in Cloudflare. No webhook between GitHub and the personal-data app or
new runtime update API is required. If no build is connected, give setup steps;
do not claim the PR alone updated the app.

Export a snapshot before an upgrade requiring data migration, review checkpoint
availability and rollback limits, and preserve bindings/migration history.
Failed checks before upload leave production untouched. A failed deployment or
post-deployment check requires examining the actual active version; do not claim
every possible deploy failure automatically rolled back. Reverting a merged PR
may enqueue a compatible redeployment, but incompatible SQL changes still need
explicit recovery and compatible code. Source tracking after a Git revert must
match the code actually kept; do not blindly advance or rewind metadata.

Acceptance uses an unrelated-history fixture plus a disposable downstream GitHub
repository and isolated Worker/namespace. Exercise bootstrap PR, merge-to-build,
target/config retention, source changes reflected at the same origin, data and
revoked-token retention, pending signed deliveries and rollback instructions.
Do not use `male2` as an unreviewed test target.

## Risks / Trade-offs

- **Unknown bootstrap provenance** → unique content match or explicit full SHA;
  stop on ambiguous history and replaced upstream ancestry.
- **Cloudflare/GitHub policy differences** → owner-visible setup and approval
  steps; test real PR creation and Workers Builds rather than infer from YAML.
- **Production settings overwritten by defaults** → omit provider-managed vars
  on upgrades, compare enrollment identity and detect repository/provider drift.
- **Migration or privileged workflow changes** → call them out in the PR; keep
  candidate checks unprivileged and require owner review before production merge.
- **Customizations cause conflicts** → preserve non-conflicting changes and
  report exact conflicting paths; no destructive automatic resolution.
- **Code rollback does not rewind data** → pre-upgrade snapshots/checkpoints and
  documented compatible rollback versus explicit recovery.
- **Bootstrap adds a one-time setup step** → necessary for old independent
  copies; later checks are a manual Actions run and reviewed merge.

## Migration Plan

1. Implement importer, isolated tests, enrollment metadata and bootstrap command
   in the original repository; validate the known template-copy baseline fixture.
2. Add the manual updater workflow and guarded deployment path; document required
   GitHub/Workers Builds settings and Node/Chromium checks.
3. Test the full lifecycle in a disposable downstream repository and Worker, with
   independent settings, records and pending signed deliveries. Record results
   and remove temporary resources; do not mark live acceptance from a dry run.
4. Publish operator bootstrap/update/conflict/rollback instructions. Existing
   owners choose a first update PR and verify their deployment enrollment before
   merging. No existing downstream repository is modified automatically.

## Sources

Read on 2026-10-18:

- [Cloudflare Deploy Buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/): independent repository cloning and customized settings.
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/): Git connection and branch-triggered build/deployment.
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/): build/deploy/preview commands and resource-isolation limits.
- [GitHub template repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template): independent initial commit and unrelated history.
- [GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow): token-created events and workflow approvals.
- Installed Wrangler 4.151.1 CLI: `--keep-vars` semantics and precedence of `WRANGLER_CI_OVERRIDE_NAME`; existing project source/configuration and read-only `male2` GitHub metadata.

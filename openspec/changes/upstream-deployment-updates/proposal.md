# Proposal

## Why

Deploy to Cloudflare creates an independent repository, so changes to the original GitHub project do not reach an owner's deployed copy automatically. Owners need a repeatable way to review upstream updates and redeploy the existing workspace without losing deployment settings or data.

## What Changes

- Provide an owner-triggered upstream update command and GitHub Actions workflow that prepare a reviewable pull request in the owner's repository. Merging that PR allows its existing Cloudflare Workers Builds connection to deploy the update.
- Support template copies with unrelated Git history, not only GitHub forks. Record the original repository, tracking ref and last imported upstream commit; apply the change between two pinned commits with three-way conflict detection.
- Preserve instance-specific package/Worker names, existing Durable Object identity and migrations, and local customizations. Stop with actionable conflicts instead of resetting the owner's branch or choosing upstream changes silently.
- Add a guarded upgrade deployment path that keeps the existing Worker/namespace, retains secrets and dashboard-managed variables, validates/builds before upload, and reports the source commit and deployment outcome.
- Document a one-time bootstrap for deployed copies that predate the updater, plus reviewed update, conflict, failed-build and rollback procedures.

### Confirmed intent and selected defaults

**Confirmed:** update a deployed application using new changes from the original GitHub repository; preserve the existing Cloudflare/local MVP.

**Selected MVP defaults:** manual update checks; an update PR requiring owner review; upstream `dasarpemrograman/malleable-workspace` at `main`; production deployment only after merge into the connected repository's production branch. These choices provide a small initial workflow rather than unattended production updates.

**Observed:** `dasarpemrograman/male2` is not a fork, has one source-import commit, and changes the package/Worker names to `male2`. Its tree matches upstream `0ecb5950e9349de6d6e6714ddacca1e193b4eb5b` except those names. The original repository has no updater or GitHub workflow today. Cloudflare template cloning and Workers Builds are distinct from upstream synchronization.

**Deferred:** automatic merges, scheduled update checks, in-app deployment buttons, application-held GitHub/Cloudflare credentials, updating other integration protocols, and changes to the existing malleable data model. This proposal does not modify `male2`, its Cloudflare configuration, or production resources.

## Capabilities

### New Capabilities

- `workspace-updates`: pinned upstream tracking, explicit bootstrap, reviewable update PRs, conflict handling and update outcome reporting for independent deployed copies.

### Modified Capabilities

- `workspace-deployment`: strengthen safe application upgrades with explicit target selection, retained deployment configuration, validated source promotion and a documented update/rollback path.

## Impact

- During implementation, add update/deployment tooling under `scripts/`, an explicitly dispatched updater under `.github/workflows/`, owner-created non-secret tracking metadata under `.workspace/`, operator instructions, and focused Git/Workers deployment tests.
- Adjust package deployment commands to distinguish initial template deployment from guarded upgrades; keep the initial Deploy to Cloudflare and local development workflows supported.
- Reuse GitHub PRs and the owner's Cloudflare Workers Builds connection. Require GitHub Actions PR permissions for the hosted updater, or authenticated Git/GitHub CLI for local bootstrap. Keep Cloudflare credentials in Cloudflare's build configuration, outside the updater.
- No application API, item/schema IDs, owner key, token scopes or snapshot format changes. No new application runtime service is required.
- Implementation acceptance must cover a template-style repository, local customizations/conflicts, actual merge-to-Workers deployment, and existing identity/data/token/delivery retention. This turn creates planning artifacts only.

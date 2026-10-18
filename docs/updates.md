# Updating a deployed copy

The original repository does not automatically update copies made with Deploy
to Cloudflare. Those copies are independent repositories, not necessarily forks.
An update imports a pinned upstream change into your repository for review; your
Cloudflare Git connection deploys it only after you merge into its production
branch. Local workspaces are still independent; updating source never transfers
or synchronizes workspace content.

## First update: enroll an existing copy

Use Git, Node 24 and an authenticated GitHub CLI (`gh auth login`). Check out a
reviewed commit of the original repository containing the updater, run `npm ci`,
then run the command there. Older copies do not have the updater yet.

```sh
node scripts/upstream-update.mjs --repo OWNER/COPY --baseline FULL_UPSTREAM_SHA --deployment /private/enrollment.json --output /tmp/workspace-update
```

Omit `--baseline` only when you want the importer to find a unique exact content
match, normalizing the package/Worker names. A modified or ambiguous tree needs
an explicitly reviewed full upstream SHA. Do not guess from version `0.1.0` or
commit dates. The observed original `male2` import matches
`0ecb5950e9349de6d6e6714ddacca1e193b4eb5b`, apart from its package and Worker names.
That is an example baseline, not a default for other copies.

For a clean local checkout use `--downstream /path/to/copy --repo OWNER/COPY`.
Your checkout/default branch stay untouched: the result is a separate clone at
`/tmp/workspace-update/candidate`, a summary, candidate bundle and source archive.
An existing output directory is refused. Source/target are pinned before the
patch is produced. No production deployment occurs during preparation.

The enrollment JSON contains identifiers, not secret values:

```json
{
  "version": 1,
  "accountId": "YOUR_32_CHARACTER_ACCOUNT_ID",
  "workerName": "your-existing-worker",
  "namespaceId": "YOUR_32_CHARACTER_NAMESPACE_ID",
  "bindingName": "WORKSPACE",
  "className": "Workspace",
  "objectName": "primary",
  "productionBranch": "main",
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Workspace"] }]
}
```

Use the existing account, Worker and Durable Object namespace from Cloudflare,
and copy its complete existing class-migration history. Placeholder IDs above
are deliberately invalid. Never put OWNER_KEY, API tokens, webhook signing
keys, local state or OAuth credentials in this file. The candidate commits the
non-secret record as `.workspace/deployment.json` and its upstream source/ref/SHA
as `.workspace/upstream.json`. Local-only copies may omit enrollment, but hosted
deployment of an imported copy is blocked until the destination is enrolled.

Review `summary.json` and the candidate diff. Dependency, workflow, binding and
migration changes need particular attention. The imported revision is the code
baseline once merged; it is not proof of an active deployed version. Candidate
validation and PR publication are separate stages described below.

## Conflicts and provenance failures

Uncommitted owner edits are refused, not overwritten. Commit/stash them before
retrying. Preparation preserves non-conflicting customizations, instance names,
file modes, renames and binary changes. It reports conflicting paths and removes
the unsuccessful temporary candidate instead of pushing conflict markers.
Resolve the upstream change in a reviewed branch; do not reset your default
branch or force-push upstream over your copy.

If the recorded baseline is unavailable or no longer ancestral to the target,
stop and review provenance. An explicit `--baseline FULL_SHA` is a rebaseline,
not a way to claim that unknown or discarded customizations were imported.
After a Git revert, check that the recorded imported SHA describes the source
you actually retained before preparing another update.

Do not redeploy the original template into a new Worker to update existing data.
Keep the established Worker, class, binding, namespace, migration tags and
`primary` object route. Snapshot export/restore is recovery/transfer, not the
normal upgrade mechanism. See [operations and rollback](operations.md).

## Validate and publish the first PR

Use a separate shell/container without Cloudflare credentials, production
`.dev.vars`, or a GitHub write token to validate the candidate. Only locally
created test credentials belong here:

```sh
cd /tmp/workspace-update/candidate
npm ci
npm run typecheck
npm test
npm run setup:local
npx playwright install chromium
CHROMIUM_PATH="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")" npm run test:browser
```

Return to the reviewed upstream tooling checkout to publish Git objects. Never
run candidate code in the publication shell with its write credential:

```sh
node scripts/publish-update.mjs --directory /tmp/workspace-update --repo OWNER/COPY --base main
```

The default validation state is **pending**, so this creates a draft PR. Use
`--validation passed` only after every check above succeeds; use `failed` to
publish a failed candidate as a draft for diagnosis. Publication does not merge
or deploy. It refuses a changed default-branch base, validates the bundle against
the pinned summary, and never force-pushes. Repeating a target reuses its open PR,
including any owner edits and existing validation state. A closed PR whose branch
has changed needs manual review. If the PR API fails after the branch is pushed,
retrying can reuse that unchanged branch.

Both commands require repository read access; publication additionally needs
contents and pull-request write access. Importing `.github/workflows` may also
require workflow-write permission for your GitHub credential/App. If GitHub
rejects it, grant the repository-specific permission deliberately; do not strip
workflow changes from the candidate to make a partial update appear successful.

## Subsequent updates through GitHub Actions

After the first tooling PR is reviewed and merged, open **Actions → Prepare
upstream update → Run workflow**, selecting your default production branch.
Normally leave inputs empty. An explicit baseline is for reviewed bootstrap or
rebaseline only; account and namespace IDs are for initial hosted enrollment.
Canonical upstream runs are no-ops. There is no schedule or automatic merge.

In **Settings → Actions → General**, allow GitHub Actions to create pull
requests. Organization policy may prohibit that setting; use the authenticated
local CLI fallback above if necessary. The workflow requests write permission
only for its publication job. All referenced Actions are pinned to commit SHAs.

Preparation uses the trusted workflow revision with read access. Candidate
install/type/build/runtime/browser commands run in a separate job with no
repository permission and no production/Cloudflare secrets. Publication consumes
only the preparer's immutable artifact ID, checks Git objects without checking
out the candidate, and uses the trusted tooling. Keep candidate checks out of any
separately configured `pull_request_target` workflow with secrets/write access.

Failed candidates get failed run results and draft PRs. A passing updater run
reports its own checks only. GitHub may require **Approve workflows to run** for
normal PR checks, and PRs created with `GITHUB_TOKEN` may not trigger other
workflows. Approve/run the required checks explicitly; never treat a pending or
absent check as passed. Inspect dependency, workflow, binding, migration and
owner-enrollment diffs, then merge deliberately.

## Connect Cloudflare Workers Builds

For the **existing Worker**, connect the downstream GitHub repository under
Cloudflare **Workers & Pages → your Worker → Settings → Builds**. Cloudflare's
GitHub App must be allowed to read that repository. Set its production branch
to the enrollment's `productionBranch` (usually `main`), root directory to the
app root, Node version to **24**, build command to `npm ci`, and deploy command
to **`npm run deploy`**. The wrapper runs type checking, app build/bundle and
runtime/operator tests before uploading. Browser checks belong to the PR gate;
make them required before merging. Do not replace the deploy command with a raw
`wrangler deploy` command, which bypasses enrollment checks.

Disable non-production branch/preview deployments. A version preview URL does
not isolate Durable Object state. Test previews only with separate Worker,
namespace and bindings, plus their own explicit enrollment and production-branch
selection. Do not point a test enrollment at the production namespace.

Configure the Worker build credential with permission to inspect deployments and
versions and deploy to the enrolled account. Missing read permission stops before
upload. `WRANGLER_CI_OVERRIDE_NAME` must match the enrolled Worker, and any account
or branch override must agree. The guard checks the deployed namespace/class,
local binding and literal `primary` routing, plus append-only migration history.
It refuses gradual deployments until they are finished or rolled back. Additive
migrations are listed in the result and must be reviewed before promotion.

Upgrades omit repository `vars` from the generated upload configuration and use
`keep_vars`, preserving dashboard variables and existing secrets. The upstream
empty `WEBHOOK_ALLOWED_HOSTS` default does not erase a non-empty hosted allowlist.
A new required variable or an explicit repository value different from the
provider stops deployment with variable **names only**. Configure and review the
provider setting first, then reconcile the repository. Do not copy secret values
into enrollment or Git. Fresh deployments still use template defaults: missing
OWNER_KEY stays locked and an empty receiver allowlist disables outbound receivers.

For an authenticated operator, `npm run deploy -- --dry-run` performs enrollment,
provider inspection and checks without uploading. Credential-free `npm run dev`
and local persistence are unchanged. Initial Deploy to Cloudflare copies without
upstream metadata retain initial provisioning support; enroll before their first
upstream import.

## Confirm deployment and recover from failure

A prepared PR, merged source SHA, queued build, successful build and active Worker
version are different states. Follow Cloudflare's build for the merge commit;
record its build reference and inspect the active deployment/version and namespace.
Then check owner access, workspace IDs/values/archived data, token revocation,
receiver settings and pending signed deliveries. An imported SHA alone does not
prove that version serves requests.

A failed pre-upload check leaves upload uncalled. An upload/network error needs
inspection of the provider's active version before retrying; the wrapper cannot
promise that a disconnected client means Cloudflare rejected the upload. Correct
the failed check or configuration and rerun the same reviewed source.

For compatible code rollback, revert the downstream update PR (including its
provenance record), review the resulting diff/checks and deploy through the same
guard to the same namespace. Preserve the enrollment's migration history; do not
remove already-applied tags to make an old revision pass. Export a snapshot before
schema migration. Incompatible data changes require explicit snapshot or supported
PITR recovery with writes stopped; redeploying old JavaScript does not rewind data.
See [operations](operations.md) for recovery limitations.

Acceptance of this new PR → Workers Builds journey is tracked separately in
[update verification](update-verification.md). Earlier MVP deploy/recovery tests
are not evidence that this new GitHub workflow has run.

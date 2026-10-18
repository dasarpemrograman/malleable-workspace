# Upstream update implementation verification

Recorded 2026-10-18 for `upstream-deployment-updates`. Implementation and local
checks passed. **The real downstream PR → merge → Cloudflare Workers Builds
journey has not passed acceptance.** Do not archive this change as fully verified.
See the [machine-readable record](verification/upstream-updates-2026-10-18.json)
and [operator guide](updates.md).

## Executed checks

- `npm run typecheck`: passed on Node 24.19.0.
- `npm test`: 23 tests passed, including the existing app runtime/contracts and
  11 new import/publication/deployment tests. Build and Worker bundle passed.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: one complete local
  owner journey passed at desktop and narrow widths, including accessibility.
- `npm run deploy -- --dry-run`: guarded initial-deployment path passed type,
  build, bundle and all then-current 22 tests, followed by the generated temporary
  config's real Wrangler dry run. No upload occurred. Later additions to the
  publication tests passed in the final 23-test run.
- `openspec validate upstream-deployment-updates --strict --json`: passed.
- Documented CLI bootstrap against a fresh independent local template import:
  passed, using full baseline `99de1fe087e99592a0c7a587997b12f0871b3da3`.
  Its package/Worker names and original branch remained unchanged. Only the
  temporary candidate received upstream metadata. Temporary fixture removed.
- Read-only preparation against the existing public `male2` repository found
  its unique baseline `0ecb5950e9349de6d6e6714ddacca1e193b4eb5b` and prepared a
  local candidate targeting planning commit `99de1fe...`; this was a bootstrap
  provenance check, not a live acceptance deployment or a test of all subsequently
  uncommitted updater code. No remote branch or Worker was modified.
- All four pinned first-party Action commits resolved through the GitHub API.
  YAML tests checked manual-only triggering, job credentials, trusted publication
  checkout, immutable preparer artifact IDs and actual validation-result wiring.
  Automated candidate validation/publication jobs remain static/fixture coverage. A real
  [canonical self-update run](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39095087544)
  passed at `62783476ea18cc43531ca106d6fbc641130a1365`: trusted preparation
  reported current, and candidate validation/publication were skipped. No PR or
  deployment occurred. GitHub initially rejected `runner.temp` in job-level env;
  moving that configuration into the runner step corrected its expression context.
  A regression assertion and the four publication/workflow tests passed afterward,
  along with type checking.

The Git fixtures cover unrelated template histories and forks, automatic and
explicit baseline selection, ambiguity, dirty trees, binary content, executable
modes, renames/deletes, customization retention/conflicts, unavailable/replaced
history and migration removal. Publication fixtures cover denied PR creation,
retry, draft failures, deduplication, owner-edited update branches, stale bases,
source-ref movement and tampered summaries. They use local bare Git repositories
and a fake GitHub API; none of those PR URLs identify a real PR.

Deployment fixtures verify destination/CI override/branch/routing checks,
append-only migrations, missing provider inspection, namespace mismatch, missing
OWNER_KEY, variable drift and preservation of a non-empty provider allowlist.
They inspect the generated configuration: `vars` is absent and `keep_vars` is
true. Failing checks leave the upload callback uncalled. No enrolled production
upload or real provider-setting retention was tested during this change.

Managed-environment commands used writable temporary Wrangler config/log paths
for local tests. The first browser attempt failed because the default Wrangler
registry path was not writable; the isolated rerun passed. Git subprocess tests
required the environment's network-enabled execution permission, including for
local Git operations. These are execution-environment constraints.

## Real disposable repository bootstrap

After the user created the test repository, it became accessible. It was empty
and reported public visibility. GitHub denied the integration's attempt to set
it private (`403 Resource not accessible by integration`), so only already-public
source and non-secret test metadata were published.

The test repository now contains a root commit with **no parents**,
`e741d86ed2cf99553dbca3d597441bb210e8df16`, imported from upstream
`0ecb5950e9349de6d6e6714ddacca1e193b4eb5b`. Only the package and Worker names
were changed to `mw-updates-acceptance-20261018`. This establishes the unrelated
history that the real bootstrap path must support.

The documented CLI fetched the downstream and prepared target
`2cf80b244e22d29b7d34e9dde2cc8741b8597e94`, producing candidate
`10d07519f08ca7b2b90905943fa35cc52aaba7fa`. In a separate validation process
with production credential environment variables removed and empty GitHub
configuration, `npm ci`, type checking, all 23 tests, local setup and the full
browser journey passed. The instance names remained intact. Local credentials
and persistence were ignored by Git and were not published.

The trusted publication CLI created the real
[bootstrap PR #1](https://github.com/dasarpemrograman/mw-updates-acceptance-20261018/pull/1).
Repeating publication returned that same PR with `reused: true`, without
rewriting the branch. Its body records the exact local checks and pending hosted
work. The PR is **draft and unmerged**; the downstream `main` remains the original
root commit. Normal GitHub PR checks have not run; local validation is not
represented as GitHub CI. OpenSpec task **2.4 is complete**.

`gh pr edit` hit a GitHub Projects-classic GraphQL deprecation error. Updating the
body through the REST API with a JSON input file succeeded. This does not affect
the updater's successful branch/PR creation or duplicate detection.

## Remaining hosted acceptance blockers

The earlier attempt to create this repository was denied by the integration;
the user's creation resolved that blocker. GitHub access is now sufficient for
the tested bootstrap branch and PR operations. Repository Actions settings could
not be read with this integration, so their administrative configuration is not
claimed as verified.

Wrangler's authentication check requires login. A fresh login was started, but
its authorization-code window expired before completion. No Cloudflare Worker,
namespace or Workers Builds connection was created, and no hosted enrollment
has been committed. The draft PR explicitly requires enrollment before promotion.

OpenSpec tasks **4.1 and 4.2 remain unchecked**. Completing them requires
Cloudflare authentication, an isolated test Worker/namespace, and the test
repository's Workers Builds Git connection. Establish the baseline deployment
and data first, add the real destination enrollment to the candidate, then
review/promote the test PR deliberately. Record the build's source commit and
active Worker version/namespace, and verify owner/data/archive/token/delivery
retention plus failed-build and compatible rollback/recovery paths.

The disposable repository and draft PR are deliberately retained for those
remaining tests. Remove only their test resources after acceptance completes.
No PR was merged, no existing branch was reset, and no Worker was deployed or
deleted during this continuation. `male2` remains outside the acceptance target.
Earlier MVP hosted evidence does not replace the outstanding update tests.

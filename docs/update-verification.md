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
  Candidate validation/publication remain static/fixture coverage. A real
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

## External acceptance blockers

GitHub rejected creation of the authorized private disposable repository
`dasarpemrograman/mw-updates-acceptance-20261018` with:
`GraphQL: Resource not accessible by integration (createRepository)`.
A later lookup could not resolve that repository. No disposable repository,
real update PR or Workers Builds integration was created. The session's Wrangler
authentication check also did not succeed; production access is not assumed.

OpenSpec tasks **2.4, 4.1 and 4.2 remain unchecked**. Their documentation exists,
but their required live evidence does not. Completing them requires access to an
empty disposable downstream repository, a Cloudflare test destination, and that
repository's Workers Builds Git connection. Use isolated settings and credentials.
Run the real workflow, review/promote the test PR deliberately, record the build's
source commit and active Worker version/namespace, and verify owner/data/archive/
token/delivery retention plus failed-build and compatible rollback/recovery paths.

No existing downstream default branch was reset, no PR was merged, and no Worker
was deployed or deleted for this implementation. There are no newly provisioned
external resources to clean up. `male2` remains outside the acceptance target.
Earlier MVP hosted evidence does not replace these outstanding tests.

# Upstream update verification

Recorded 2026-10-18 for `upstream-deployment-updates`. The real bootstrap PR,
merge-to-Workers-Builds deployment, retention, failed-build and compatible recovery
checks passed on disposable resources. The full GitHub updater passed all three
jobs and created PR #2 without merging it. Both Workers and their namespaces
have been deleted and verified absent. Only test-repository cleanup remains;
GitHub denied the integration permission to delete it.

Evidence: [local and bootstrap record](verification/upstream-updates-2026-10-18.json)
and [hosted acceptance record](verification/upstream-updates-hosted-2026-10-18.json).
See the [update guide](updates.md) for operator commands and recovery limits.

## Local and GitHub checks

- Node 24.19.0: type checking passed; all 23 runtime/contract/operator tests passed.
- The complete browser journey passed at desktop and narrow widths, including
  accessibility, for the renamed bootstrap candidate.
- The guarded initial-deployment dry run passed without upload.
- Strict OpenSpec validation passed.
- Git fixtures covered unrelated template histories, forks, baseline ambiguity,
  dirty trees, conflicts, binary content, modes, renames/deletes, missing history,
  migration guards, PR retries/deduplication, owner-edited branches, source-ref
  movement, stale bases and artifact-summary tampering.
- All four pinned Action commits resolved. The real
  [canonical no-op run](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39095087544)
  passed without creating a candidate or deploying.

Two platform integration issues were found and corrected: `runner.temp` must be
resolved inside a runner step rather than job-level environment settings, and
ID-based artifact downloads require `merge-multiple: true` to place the bundle
and summary in their expected input directories. The latter fix is commit
`12ea0e70b60cb8aee3ca5ebcd571eaa4b404870c`, with a regression assertion in the
workflow test. The trusted preparer's immutable artifact ID remains required.

The first full downstream workflow
[39100974859](https://github.com/dasarpemrograman/mw-updates-acceptance-20261018/actions/runs/39100974859)
exposed the artifact layout issue. The corrected
[39101234346](https://github.com/dasarpemrograman/mw-updates-acceptance-20261018/actions/runs/39101234346)
passed preparation, its separate unprivileged candidate-validation job, and
trusted publication. Validation ran dependency installation, type/build/runtime
checks, all 23 tests and the browser journey without production application or
Cloudflare credentials. Publication initially pushed its branch and reported
`github_access` when repository policy blocked PR creation. After the owner
enabled Actions PR creation, retry succeeded and created
[PR #2](https://github.com/dasarpemrograman/mw-updates-acceptance-20261018/pull/2),
reusing the existing candidate branch without rewriting it. PR #2 remained
unmerged and the downstream default branch stayed unchanged. The candidate
retained pinned target `12ea0e7...` even after upstream evidence commits advanced.

## Independent template bootstrap and promotion

The user-created repository was empty and reported public visibility. GitHub
rejected the integration's attempt to make it private. Only previously public
source and non-secret enrollment metadata were published there.

The independent root commit `e741d86ed2cf99553dbca3d597441bb210e8df16` has no
parents and was imported from upstream
`0ecb5950e9349de6d6e6714ddacca1e193b4eb5b`. Only package/Worker names were
normalized to `mw-updates-acceptance-20261018`. Bootstrap prepared upstream target
`2cf80b244e22d29b7d34e9dde2cc8741b8597e94` as candidate
`10d07519f08ca7b2b90905943fa35cc52aaba7fa`; all candidate checks passed in a
separate local process without production credential environment variables.

The real [PR #1](https://github.com/dasarpemrograman/mw-updates-acceptance-20261018/pull/1)
was created with the publication CLI. Repeating publication returned the same PR
without rewriting it. It remained draft/unmerged until the baseline Worker and
its real namespace were enrolled in commit
`3359a5fa0ca44550f4d84d6f13d907dbbb8e92ed`. After baseline data was seeded and
the owner connected Workers Builds, explicit test-owner promotion created merge
commit `91c6f424d44cc05c1a6dd8c4a74eab573f1abec9`. GitHub records PR #1 as merged.
There was no automatic merge policy or production application updater endpoint.

## Real Workers Builds

Initial provisioning used Wrangler CLI solely to establish the old baseline.
Every upgrade, failure and recovery below was triggered through the connected
repository's production branch. No CLI deployment substituted for those builds.
The owner confirmed Node 24, `npm ci`, `npm run deploy`, production branch `main`
and disabled non-production deployments. Workers Builds API access requires a
Workers CI permission unavailable through this Wrangler OAuth login; successful
GitHub check runs and the Workers API supplied independent build/version evidence.

| Operation | Downstream source commit | Workers Builds reference | Active version |
| --- | --- | --- | --- |
| Bootstrap promotion | `91c6f424d44cc05c1a6dd8c4a74eab573f1abec9` | `72faeccd-5a18-40cf-888e-6b70d0120266` — success | `fa650cd7-aef6-4713-bffc-20db816ff4dd` |
| Compatible UI change | `cfdf53e74eb33a40bd96480f13b1be3966247fb8` | `78a668b2-3f2b-4002-9968-9a8df8a8a38b` — success | `eaf2bcc7-2d47-4432-bbcd-aca0a365e8d9` |
| Intentional compile failure | `0b3d0703df09587a03469e939aeb7d87fa100c74` | `7a9a3b72-c6fb-493b-aafb-7c8fbca1f755` — failure | `eaf2bcc7-2d47-4432-bbcd-aca0a365e8d9` unchanged |
| Compatible recovery | `cac2b00c6802b0d42e0885d8c48f2afc38749c03` | `7baa98ad-f449-449d-8323-6c1ee29b0d0f` — success | `3b00cd5d-e6e0-47a0-b58a-ecc0662a2763` |
| Trusted workflow maintenance | `a11a3f5c4eaab63f4e76b1dd1e2be6a944518171` | `0999ef0f-d72b-478a-bd07-ab735618d2ca` — success | `788a9a32-72c3-4bd8-a6bd-33a2f3e93487` |

All serving versions used the same test origin, Worker tag
`3ebf322e60f94b2c9d04364ec3ede5d8`, binding `WORKSPACE`, class `Workspace`,
namespace `9a8d0d59579f43659ff88543f91172e1` and literal `primary` route.
Package and Worker names were preserved. The non-empty provider receiver
allowlist survived the repository's empty default, and the existing OWNER_KEY
remained usable. No secret values were committed or included in public evidence.

## Retention and recovery

The baseline contained all four field kinds, zero/false values, an option,
archived fields/items, a saved board, active and revoked tokens, and a signed
receiver subscription. After each successful deployment, the expected failed
build, and compatible recovery, the exported snapshot matched exactly, with
SHA-256 `55e834a326f473d8715bd0c4ab82012d3ca9e7972bbee7a17db21a2215875d34`.
Workspace/schema/item IDs, values and archives were retained; the original owner
key worked, the active token remained usable and the revoked token returned 401.

A real HTTPS receiver returned 503 to establish pending delivery
`b7535619-c8a6-4319-85fc-56957520bb0c`. The subscription was paused during the
build so the existing retry budget would not expire while deployment ran. After
upgrade, the same pending delivery retained its attempt count. Re-enabling the
subscription resumed it successfully on attempt two. Both receipts carried the
same event ID and verified HMAC signatures over the exact bytes and timestamp.
This proves retained/resumed pending work; it does not claim uninterrupted
receiver availability during the build.

A deliberately invalid TypeScript file produced local diagnostic TS2322. Its
corresponding Workers Build failed while the previously serving version and UI
remained unchanged. Recovery reverted that file and the successful UI title
change, preserving upstream tracking, deployment enrollment, migration history
and the deployment guard. Workers Builds restored the original title, and the
snapshot still matched. No database migration or database rewind was attempted;
this is compatible code rollback evidence, separate from earlier MVP PITR tests.

## Cleanup

The disposable application and receiver Workers were each torn down with an
explicit `acceptance-cleanup-v2` class-deletion migration, then deleted. These
were cleanup operations after acceptance, separate from the tested upgrade
path. Worker service lookups returned 404; a complete paginated namespace list
confirmed both test namespaces were absent. No existing deployment was deleted.

GitHub denied test-repository deletion with HTTP 403. The owner has been asked
to delete only `dasarpemrograman/mw-updates-acceptance-20261018`, or explicitly
retain it as an acceptance artifact. Task 4.3 remains incomplete until that last
cleanup decision is resolved. Build/PR/version references are preserved in the
sanitized evidence even if the disposable repository is subsequently deleted.

Earlier local checks used temporary writable Wrangler config/log paths; an
initial browser attempt failed on the read-only default registry path, then
passed with an isolated temporary config directory.

`male2` and other existing deployments were not modified. The earlier read-only
`male2` provenance check and previous MVP acceptance do not replace this change's
new downstream-to-Workers-Builds evidence.

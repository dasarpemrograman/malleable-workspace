# Contributor workflow acceptance

Recorded on 2026-10-18 (Asia/Jakarta) for `contributor-first-codebase`.
The implemented application/tooling walkthrough used commit
`2292f1bcbf9ba5caa6f04663242d0ac74679b898`, Node 24.19.0 and npm 11.9.0 on Linux.
The final follow-up makes the formatter's test probe directory unique; it changes
test isolation only and has a focused passing regression check.

Machine-readable results, source SHAs, exact commands, deliberate failures,
CI job references and cleanup are in
[the acceptance record](verification/contributor-first-2026-10-18.json).

## Results

| Check | Result |
| --- | --- |
| Before implementation | Typecheck, 23 tests and one browser journey passed |
| Focused contracts, with build outputs absent | 4 passed |
| Focused runtime, with fixture output absent | 9 passed |
| Focused operators, without prebuilt outputs | 17 passed |
| Aggregate formatting/type/build/bundle/tests | 30 passed, zero failed or skipped |
| Browser journey | Passed, desktop/narrow/accessibility and conflict drafts |
| OpenSpec | All seven active/main-spec checks passed strictly |
| Watched local development | Client/Worker edits, syntax-error recovery and lifecycle checks passed |
| Check failure propagation | Formatting, TS2322, focused-test and aggregate-test failures returned nonzero |

A separate clone was installed with `npm ci`, configured with `setup:local` and
used without production credentials. Each focused suite started without `dist`
or `.worker`. A deliberately malformed maintained file remained byte-identical
after `format:check`. Documentation links resolved. The supported Node selection
matches package engines and CI. Existing tests remain a disjoint partition of
the focused suites and appear once in the aggregate.

## Local development and compatibility

The walkthrough logged into `http://127.0.0.1:8787`, created an item and exported
the workspace. A client edit appeared in rebuilt served assets; a Worker edit
appeared through a temporary API route in the disposable checkout. A syntax error
was reported and a subsequent correction rebuilt successfully without restarting
the development command. None of those edits was retained in project source.

Workspace export SHA-256 remained
`e187c10c7ceab05451e0eb12137c7db1b1c37feba77728c9d9bde34c03b6250b`
through edits, error recovery, normal restart and unexpected Worker-child
termination. Owner access remained valid and the local key file was unchanged.
The same export was verified again after all focused, aggregate and browser
checks, proving test isolation from development state. Ctrl-C released the port;
an occupied port failed visibly; unexpected child termination returned failure.

The first real lifecycle check found that the build watcher's signal handling
could exit before Wrangler cleanup. Persistent signal handlers and cleanup of
the owned process group before watcher disposal fixed it. A real Vite/Wrangler
fixture now covers Ctrl-C port release, alongside initial-build interruption,
build-error recovery and child-failure tests. Early walkthrough harness mistakes
(a JSX string split across lines, a probe route intercepted by SPA assets, and a
Python port check without address reuse) were corrected before the successful
recorded walkthrough; they are not counted as app failures or passing evidence.

Backend request/auth/owner/delivery method bodies were compared with the original
after mechanical capability substitutions and formatting. Existing transaction
boundaries and SQL behavior were retained. Runtime checks cover IDs, zero/false
values, archives, scopes/revocation, snapshots, persistence, signing, retry budgets
and disabled subscriptions. A new delayed-receipt regression verifies that an old
completion cannot overwrite a newer cycle or mark its reservation audit successful.
The Worker export, binding, literal `primary` route, class migration history and
existing upgrade/deployment guard are unchanged. Test-only RPCs remain excluded
from the production bundle. No data migration was introduced.

## Hosted CI

These are actual GitHub Actions runs, not conclusions inferred from workflow YAML.
The final application/tooling implementation passed all three selection/core/browser
jobs for each successful trigger:

| Trigger | Run | Source |
| --- | --- | --- |
| Push | [39121661779](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39121661779) | `2292f1b` |
| Manual full-SHA dispatch | [39121714984](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39121714984) | `2292f1b` |
| Ordinary PR | [39121709287](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39121709287) | `20e9e75` (disposable acceptance branch) |
| Invalid SHA dispatch, expected failure | [39121469977](https://github.com/dasarpemrograman/malleable-workspace/actions/runs/39121469977) | Selection failed; core/browser skipped |

The push log explicitly reports 30 tests passed, zero failed or skipped, and the
browser journey passed. The workflow uses pinned Actions, no persisted checkout
credential, read-only repository access and no production/deployment secrets or
commands. Manual dispatch identifies the requested and checked-out commit and
rejects malformed input before checkout. It does not claim a manual run satisfies
a PR-associated branch-protection check. Existing updater artifact/permission
and publication fixtures passed unchanged.

The PR used a same-repository branch representing untrusted contribution code;
an external-account fork and an actual maintainer-approval prompt were not directly
exercised. Their approval/credential boundaries were checked in configuration and
documented. macOS and Windows were not exercised. No hosted app was redeployed;
compatibility evidence here is local runtime, packaging and browser regression
coverage. Existing `male2` and other production resources were untouched.

## Scenario mapping

| New scenario | Evidence |
| --- | --- |
| Start from a clean checkout | Independent clone, npm install/setup, private sign-in and real dev walkthrough |
| Prerequisite is missing | Node guard, documented browser install/override and actionable runtime/port errors |
| Edit frontend or backend code | Served client marker and temporary API response observed without restart |
| Recover from a compilation error | Failed client edit followed by a new successful served asset |
| Stop or fail the development command | Actual Ctrl-C, Worker-child failure, restart, port reuse; real supervisor regression |
| Validate one area from a clean checkout | Each focused suite prepared its own removed outputs; intentional selected failure propagated |
| Run complete validation | Aggregate 30-test run, failure probes and separate successful browser CI |
| Check an incorrectly formatted edit | Non-mutating formatter probe and matching explicit fix/check scopes |
| Validate with existing local data | Identical export/key after all suites and browser acceptance |
| Validate an external contribution | Read-only workflow/credential assertions plus real ordinary branch PR; external-account fork limitation above |
| Repository policy requires approval | Contributor approval instructions and explicit pending/skipped distinctions; approval prompt not encountered |
| Review automation-created updates | Actual explicit-SHA dispatch and rejected malformed dispatch; updater results remain separate |
| Locate a small change | Architecture map resolves real feature/route/delivery modules and matching focused suites |
| Preserve inbound clients across refactoring | Existing auth/item/schema/scopes/snapshot/runtime and contract checks |
| Preserve outbound connections across refactoring | Signing, persistence, retries, disable and late-completion regressions |
| Submit a contribution | README entry, guide, Scoped Commits examples and PR template |
| Plan a contract-changing contribution | Refreshed project context and explicit proposal/apply/contract-review instructions |

## Cleanup

Disposable [PR #1](https://github.com/dasarpemrograman/malleable-workspace/pull/1)
was closed without merging; its remote and local acceptance branch were deleted.
The acceptance worktree and temporary clean/failure clones, local test keys and
state were removed after preserving sanitized evidence. Test-owned processes
were stopped. Development data in the shared repository was not removed, and
no Cloudflare resources or production configuration were changed.

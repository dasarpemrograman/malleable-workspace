# Contributing

Start with a small change, run the checks for its area, then explain the problem,
result and validation in your PR. You do not need a Cloudflare account to contribute.

## First checkout

Use Node **24** and npm (the lockfile is committed). With nvm, run `nvm use`.
Check `node --version` before installing; older Node releases are unsupported.

```sh
npm ci
npm run setup:local
npm run dev
```

Open http://127.0.0.1:8787 and read your generated `OWNER_KEY` privately from
`.dev.vars` to sign in. Setup preserves an existing key. Never paste keys into a
PR, commit, screenshot or log. No login to Cloudflare or production key is needed.

Client assets rebuild when you save; refresh the browser to see them. Wrangler
reloads Worker changes. This is build-watch, not hot module replacement. Syntax
errors appear in the terminal; fix the source and the watcher rebuilds. Your
workspace lives in `.wrangler/state` and survives edits/restarts. Ctrl-C stops
the watchers and server. Do not delete your state as a build-error workaround.

Dependencies and a browser require connectivity to install; ordinary local
editing works offline afterward. Outbound webhook receivers require connectivity.
Linux is the exercised development/CI platform. macOS uses the same Node commands;
macOS and Windows are not verified by the Linux acceptance run.

## Choose checks

| Change                                             | Useful command           |
| -------------------------------------------------- | ------------------------ |
| Domain rules, published API or packaging           | `npm run test:contracts` |
| API, authentication, storage or deliveries         | `npm run test:runtime`   |
| Update/deploy tools or contributor tooling         | `npm run test:operators` |
| Full build and all non-browser tests               | `npm test`               |
| Formatting, types, build and all non-browser tests | `npm run check`          |
| Browser behavior and accessibility                 | `npm run test:browser`   |

Focused suites prepare their own artifacts. `npm test` remains the full check
used by guarded deployments. Browser acceptance is separate; run it for UI and
cross-cutting changes. Before the first browser run:

```sh
npx playwright install chromium
CHROMIUM_PATH="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")" npm run test:browser
```

On minimal Linux installations, `npx playwright install --with-deps chromium`
also installs browser system libraries (requires system package permissions).
An installed Chromium can instead be selected with `CHROMIUM_PATH=/path/to/chromium`.
The browser server uses port 8788 and resets only `.wrangler/browser-tests`.
Runtime tests use temporary Miniflare instances. Neither uses `.wrangler/state`.

`npm run format:check` reports formatting without changing files; `npm run format`
applies fixes to maintained files. Generated files, secrets, local data and
historical acceptance evidence are excluded. Keep formatting-only changes separate
from behavior changes when practical.

## Find the code

Use the [architecture and change map](docs/architecture.md) to locate UI, API,
schema, authentication, storage, delivery and operator boundaries. Keep a change
within its owning module where possible; avoid unrelated abstractions.

Existing API IDs, token scopes, conflict handling, snapshot format, webhook signing
and delivery budgets are contracts. See [API](docs/api.md),
[webhooks](docs/webhooks.md), [operations](docs/operations.md) and the
[main specifications](openspec/specs/). A refactor must preserve these contracts.

## Commits and review

Use [Scoped Commits](https://scopedcommits.com/): `scope: description`.
The scope names the area; there is no mandatory `feat`/`fix` taxonomy or local hook.

```text
client: retain an unsaved item draft after a conflict
workspace: preserve delivery leases during retries
updates: reject an unavailable upstream baseline
ci: validate external pull requests without deployment credentials
docs: explain browser setup
```

PRs should explain the problem and resulting behavior, list checks actually run,
and identify meaningful limitations. Include screenshots for visible changes and
contract/migration notes when relevant. Do not claim pending or absent checks passed.
Small fixes can use existing specs; do not invent specification changes for them.
For new behavior/contracts, use `/ospx:propose`, review its artifacts, then explicitly
request `/ospx:apply`. A proposal authorizes planning only, not implementation or deploy.

## GitHub checks

The `core` and `browser` checks run the same commands described above on pull
requests and pushes to `main`. Maintainers may make them required in branch
protection; this repository tooling does not change that policy automatically.
External PRs may show **Approve workflows to run**: a maintainer must approve,
then inspect the actual run. CI never needs production secrets or deploy credentials.

GitHub may suppress normal CI for PRs created by `GITHUB_TOKEN`, including upstream
update PRs. Updater checks and ordinary PR checks are separate. A maintainer can
run **Contribution checks → Run workflow** from `main`, supplying the PR head's
full 40-character commit SHA. Confirm the displayed tested SHA still matches the
PR head. Manual evidence does not satisfy a protection rule requiring a check on
the PR itself; follow repository policy rather than bypassing review. Never use
`pull_request_target` with secrets/write access to run contribution code.

## Troubleshooting

- Wrong Node version: select Node 24, reinstall with `npm ci` and rerun the check.
- Missing `.dev.vars`: run `npm run setup:local`; do not reuse example placeholders.
- Port 8787/8788 occupied: stop the other local process and retry; do not kill
  unrelated processes or delete workspace state. `MW_DEV_PORT` selects a different
  development port; browser acceptance still uses 8788.
- Missing browser: run the browser installation command or set `CHROMIUM_PATH`.
- Read-only Wrangler home in a sandbox: set `XDG_CONFIG_HOME` and
  `WRANGLER_LOG_PATH` to private writable temporary paths for that command.
- Failed build: read its error, correct the source, and wait for a successful
  rebuild. Watch mode does not replace `npm run typecheck`.
- Upstream history rewritten: follow the [reviewed rebaseline procedure](docs/updates.md);
  historical verification SHAs describe the runs that actually happened.

# Architecture and change map

The app has one origin: static client assets and HTTP requests pass through
`src/worker/index.ts`. API/auth/owner requests reach the existing `Workspace`
Durable Object through `WORKSPACE.getByName("primary")`. Each instance owns its
SQLite data and secrets. Source updates do not synchronize workspace content.

## Where to change things

| Area                                                  | Entry point / owner                                | Checks                                    |
| ----------------------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Mount, styles, application navigation/polling         | `src/client/main.tsx`, `App.tsx`, `style.css`      | Typecheck, browser                        |
| HTTP client and session/schema types                  | `src/client/api.ts`                                | Typecheck, browser                        |
| Shared dialog, icon, errors, inline rename            | `src/client/components/`                           | Browser, accessibility                    |
| Item editing, schema/options, connections, restore    | `src/client/features/`                             | Browser, corresponding runtime suite      |
| Domain types, schema/value/snapshot validation        | `src/domain/model.ts`                              | Contracts, runtime                        |
| Key validation, origins, receiver URL policy/signing  | `src/domain/security.ts`                           | Contracts, runtime auth/deliveries        |
| Durable Object lifecycle and service wiring           | `src/workspace/workspace.ts`, `context.ts`         | Runtime, contracts                        |
| Initialization, records, metadata and revision checks | `src/workspace/store.ts`                           | Runtime persistence/schema-versions/items |
| Request body limits, principals, sessions and login   | `src/workspace/auth.ts`                            | Runtime auth/scopes                       |
| API dispatch, listing and mutations                   | `src/workspace/routes.ts`                          | Runtime items/scopes, contracts           |
| Views, tokens, subscriptions and snapshots            | `src/workspace/owner-routes.ts`                    | Runtime auth/persistence/deliveries       |
| Events, delivery scheduling, reservation and receipt  | `src/workspace/deliveries.ts`                      | Runtime deliveries/persistence            |
| JSON response headers                                 | `src/workspace/http.ts`                            | Runtime, contracts                        |
| Upstream import, publication and guarded deploy       | `scripts/lib/`, CLI entry points in `scripts/`     | Operators                                 |
| Local edit feedback and test/format commands          | `scripts/dev.mjs`, `test.mjs`, `format.mjs`        | Operators, local acceptance               |
| Ordinary PR checks / trusted updater                  | `.github/workflows/ci.yml` / `upstream-update.yml` | Operators, real Actions runs              |

Paths in the first rows are relative to `src/client/` where a directory is not
repeated. The [contributor guide](../CONTRIBUTING.md) lists suite commands.
To narrow a runtime run, for example:

```sh
npm run test:runtime -- --test-name-pattern="signed webhooks"
```

## Boundaries worth preserving

Client features receive explicit state and callbacks; transport is shared through
`api.ts`. UI names/layouts can change without changing resource IDs. Keep polling,
unsaved drafts, conflict handling, bounded pagination and accessible controls
working when extracting or adding a component. Domain code does not depend on UI.

`Workspace` owns one storage handle and its concurrency barrier. The store and
request/delivery modules are ordinary helpers, not additional Durable Objects or
remote services. Helpers take typed capabilities from `context.ts`; type-only
imports do not create runtime dependency cycles. Authentication and origin checks
run centrally before protected routing. Authorization stays at the relevant action
boundary as well. Never add helper methods as public Durable Object RPCs.

Mutation and event creation remain in the same storage transaction. Delivery
reservation, leases, retry cycles and completion checks retain their separate
transactions; outbound HTTP remains outside storage transactions. A receipt from
an old cycle must not overwrite a newer attempt. Do not move an `await` or split
a transaction just to make a file smaller.

## Contracts and data

[Main specifications](../openspec/specs/), [API/OpenAPI](api.md),
[webhook semantics](webhooks.md), and [operations](operations.md) describe the
published behavior. IDs, token scopes/revocation, request/error shapes, snapshot
format and exact signed bytes are compatibility boundaries. New behavior needs
explicit review and appropriate spec changes; structural extraction alone does not.

Keep the `Workspace` export, `WORKSPACE` binding, `primary` routing and append-only
Wrangler migration history. The upgrade tooling verifies those identities. Never
reset storage or create a replacement namespace as a refactoring shortcut. No new
SQL migration is needed for this module organization. Recovery is explicit
snapshot/PITR recovery with compatible code; a code revert does not rewind data.

## Tests and execution authority

`tests/helpers/runtime.ts` constructs isolated Miniflare instances.
`tests/runtime/` groups behavior by items, authentication, persistence, delivery,
scopes, schema versions, offline use and the real HTTP client example.
`tests/fixture-worker.ts` alone supplies test SQL/alarm RPCs; production packaging
checks ensure they never ship. Operator fixtures use temporary Git repositories.

`npm test` discovers every `.test.ts` recursively. Browser `.spec.ts` files run
separately against `.wrangler/browser-tests`; development uses `.wrangler/state`.
Formatting/test commands do not own or remove user data, keys or exported snapshots.

Ordinary contribution CI has read-only repository access and no production secrets.
The upstream updater separately prepares an immutable artifact, executes candidate
checks without write credentials, then publishes Git objects from trusted tooling.
Do not collapse those stages or execute candidate code in privileged publication.
Deployment is a separate explicit operator action through the existing guard.

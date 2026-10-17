# Signed outbound webhooks

1. The operator puts trusted public DNS hostnames in WEBHOOK_ALLOWED_HOSTS (JSON
   array, empty by default). Local keys/vars can be in ignored `.dev.vars`;
   production values are configured through Wrangler/dashboard.
2. In Connections, add an HTTPS receiver on port 443 and select item events,
   schema events, or both. Save the signing secret shown once.
3. Verify the signature on the exact raw request bytes before parsing JSON.
   Use `examples/verify-webhook.mjs` as the starting point.

Receivers get post-mutation resource snapshots, including personal content.
Only explicitly selected event families created while the subscription is enabled
are queued. Disabling stops future attempts; an already in-flight send can finish.
The hostname policy is checked on every attempt. It rejects IP literals, local
names, credentials/fragments, non-443 ports, self-targets, non-allowlisted hosts,
and redirects. Do not add private network bindings/origin overrides. Hosted
Workers uses public fetch routing; local execution trusts the operator's chosen
hostname/DNS. This is not Node-style DNS/IP pinning or an untrusted URL proxy.

Headers:

- X-Workspace-Event-Id: immutable event UUID.
- X-Workspace-Timestamp: attempt time in Unix seconds.
- X-Workspace-Signature: `sha256=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>`.

JSON envelope: `{version:1,id,workspaceId,type,resourceId,resourceRevision,
occurredAt,actor,data}`. Actor is a non-secret owner/token ID. Event types:
item.created/updated/archived/restored, type.created/updated,
field.created/updated/archived/restored, option.created/updated.
Snapshots and event bytes are immutable. Retries preserve ID/body, but sign a new
attempt timestamp. Reject timestamps outside five minutes and modified bodies.

Durably deduplicate `(workspaceId,eventId)` at the receiver, atomically with any
side effect. The example verification helper does not supply your production
deduplication database. Do not automatically forward changes back and forth
without an application-specific loop policy.

Only 2xx succeeds. Alarms process at most two deliveries at once, each with a
10-second timeout. There are three reserved request slots per cycle, with earliest
retry delays of 10 and 60 seconds. An interrupted slot is consumed; receipt can be
unknown. Platform alarm retries cannot reset these counters. Delivery may duplicate
and is best effort within bounded slots; receipt/order/exactly-once is not promised.
Pending and in-flight state survive restarts/eviction. After exhaustion, the owner
can manually start another bounded cycle retaining event ID and total accounting.

Connections shows the latest 100 delivery records with destination, event ID,
state, slot/total counts, timestamps, HTTP status or failure category. Arbitrary
receiver response bodies and secrets are not recorded. Offline edits still commit;
external failure never rolls back accepted content. Attempt/event/delivery history
is currently retained; monitor storage growth until retention tooling is added.

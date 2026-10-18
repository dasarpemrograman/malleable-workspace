import {
  AppError,
  requireThat,
  name,
  id,
  revision,
  type Resource,
  type Type,
  type Subscription,
  type Event,
  type Delivery,
} from "../domain/model";
import {
  secret,
  signature,
  allowedHosts,
  receiverUrl,
} from "../domain/security";

import { json } from "./http";
import type { WorkspaceContext } from "./context";

export async function emit(
  ctx: Pick<WorkspaceContext, "schedule" | "store">,
  type: string,
  r: Resource,
  actor: string,
) {
  const e: Event = {
    version: 1,
    id: crypto.randomUUID(),
    workspaceId: ctx.store.meta().id,
    type,
    resourceId: r.id,
    resourceRevision: r.revision,
    occurredAt: new Date().toISOString(),
    actor,
    data: r,
  };
  ctx.store.put("event", e);
  const family = type.startsWith("item.") ? "item" : "schema";
  for (const s of ctx.store
    .all<Subscription>("subscription")
    .filter((s) => s.enabled && s.families.includes(family))) {
    const now = Date.now();
    ctx.store.put("delivery", {
      id: crypto.randomUUID(),
      eventId: e.id,
      subscriptionId: s.id,
      state: "pending",
      cycle: 1,
      attempts: 0,
      totalAttempts: 0,
      due: now,
      lease: 0,
      createdAt: e.occurredAt,
      updatedAt: e.occurredAt,
      outcome: null,
    } satisfies Delivery);
  }
  await ctx.schedule();
}

export async function schedule(ctx: Pick<WorkspaceContext, "storage">) {
  const row = ctx.storage.sql
    .exec<{ due: number }>(
      `SELECT min(CASE WHEN json_extract(d.data,'$.state')='inflight' THEN json_extract(d.data,'$.lease') ELSE json_extract(d.data,'$.due') END) AS due FROM records d JOIN records s ON s.kind='subscription' AND s.id=json_extract(d.data,'$.subscriptionId') WHERE d.kind='delivery' AND json_extract(d.data,'$.state') IN ('pending','inflight') AND json_extract(s.data,'$.enabled')=1`,
    )
    .toArray()[0];
  if (row?.due != null)
    await ctx.storage.setAlarm(Math.max(Date.now() + 1, row.due));
  else await ctx.storage.deleteAlarm();
}

export async function alarm(
  ctx: Pick<WorkspaceContext, "env" | "schedule" | "storage" | "store">,
) {
  const jobs = await ctx.storage.transaction(async () => {
    const now = Date.now();
    const expired = ctx.storage.sql
      .exec<{ data: string }>(
        "SELECT data FROM records WHERE kind='delivery' AND json_extract(data,'$.state')='inflight' AND json_extract(data,'$.lease')<=?",
        now,
      )
      .toArray();
    for (const r of expired) {
      const d = JSON.parse(r.data) as Delivery;
      d.state = d.attempts >= 3 ? "failed" : "pending";
      d.due = now + (d.attempts === 1 ? 10000 : 60000);
      d.outcome = "interrupted_receipt_unknown";
      d.updatedAt = new Date().toISOString();
      ctx.store.put("delivery", d);
    }
    const due = ctx.storage.sql
      .exec<{ data: string }>(
        `SELECT d.data FROM records d JOIN records s ON s.kind='subscription' AND s.id=json_extract(d.data,'$.subscriptionId') WHERE d.kind='delivery' AND json_extract(d.data,'$.state')='pending' AND json_extract(d.data,'$.due')<=? AND json_extract(s.data,'$.enabled')=1 ORDER BY json_extract(d.data,'$.due'),d.id LIMIT 2`,
        now,
      )
      .toArray();
    const reserved: Delivery[] = [];
    for (const r of due) {
      const d = JSON.parse(r.data) as Delivery;
      if (d.attempts >= 3) {
        d.state = "failed";
        ctx.store.put("delivery", d);
        continue;
      }
      d.state = "inflight";
      d.attempts++;
      d.totalAttempts++;
      d.lease = now + 15000;
      d.updatedAt = new Date().toISOString();
      ctx.store.put("delivery", d);
      ctx.store.put("attempt", {
        id: `${d.id}.${d.totalAttempts}`,
        deliveryId: d.id,
        cycle: d.cycle,
        slot: d.attempts,
        startedAt: d.updatedAt,
        outcome: "inflight",
      });
      reserved.push(d);
    }
    await ctx.schedule();
    return reserved;
  });
  await Promise.all(
    jobs.map(async (job) => {
      let outcome = "network_error",
        success = false;
      try {
        const s = ctx.store.get<Subscription>(
          "subscription",
          job.subscriptionId,
        );
        requireThat(
          s.enabled,
          "subscription_disabled",
          "Subscription disabled.",
        );
        const url = receiverUrl(
          s.url,
          allowedHosts(ctx.env.WEBHOOK_ALLOWED_HOSTS),
          s.origin,
        );
        const row = ctx.storage.sql
          .exec<{ data: string }>(
            "SELECT data FROM records WHERE kind='event' AND id=?",
            job.eventId,
          )
          .toArray()[0];
        requireThat(row, "missing_event", "Event is unavailable.");
        const timestamp = String(Math.floor(Date.now() / 1000));
        const sig = await signature(s.secret, timestamp, row.data);
        const response = await fetch(url, {
          method: "POST",
          body: row.data,
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-Event-Id": job.eventId,
            "X-Workspace-Timestamp": timestamp,
            "X-Workspace-Signature": sig,
          },
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        success = response.status >= 200 && response.status < 300;
        outcome = `http_${response.status}`;
        await response.body?.cancel();
      } catch (error) {
        outcome =
          error instanceof AppError
            ? error.code
            : error instanceof Error && error.name === "TimeoutError"
              ? "timeout"
              : "network_error";
      }
      await ctx.storage.transaction(async () => {
        const d = ctx.store.get<Delivery>("delivery", job.id);
        if (
          d.cycle !== job.cycle ||
          d.totalAttempts !== job.totalAttempts ||
          d.state !== "inflight"
        )
          return;
        d.state = success
          ? "succeeded"
          : d.attempts >= 3
            ? "failed"
            : "pending";
        d.outcome = outcome;
        d.lease = 0;
        d.due = Date.now() + (d.attempts === 1 ? 10000 : 60000);
        d.updatedAt = new Date().toISOString();
        ctx.store.put("delivery", d);
        ctx.store.put("attempt", {
          id: `${d.id}.${d.totalAttempts}`,
          deliveryId: d.id,
          cycle: d.cycle,
          slot: d.attempts,
          startedAt: job.updatedAt,
          finishedAt: d.updatedAt,
          outcome,
        });
        await ctx.schedule();
      });
    }),
  );
}

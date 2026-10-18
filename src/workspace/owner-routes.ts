import { z } from "zod";

import {
  AppError,
  requireThat,
  fresh,
  limits,
  scopes,
  name,
  id,
  validateSnapshot,
  type Type,
  type Field,
  type Option,
  type Item,
  type View,
  type Principal,
  type Token,
  type Subscription,
  type Event,
  type Delivery,
} from "../domain/model";
import { secret, digest, allowedHosts, receiverUrl } from "../domain/security";

import { json } from "./http";
import type { WorkspaceContext } from "./context";

export async function ownerRoute(
  ctx: Pick<
    WorkspaceContext,
    "body" | "env" | "mutate" | "schedule" | "storage" | "store"
  >,
  request: Request,
  u: URL,
  p: Principal,
): Promise<Response> {
  const path = u.pathname,
    method = request.method;
  if (path === "/owner/views" && method === "GET")
    return json(ctx.store.all<View>("view"));
  const vm = path.match(/^\/owner\/views(?:\/([a-f0-9-]+))?$/);
  if (vm && ((method === "POST" && !vm[1]) || (method === "PATCH" && vm[1])))
    return json(
      await ctx.mutate("view", vm[1], await ctx.body(request), p),
      vm[1] ? 200 : 201,
    );
  if (path === "/owner/tokens" && method === "GET")
    return json(ctx.store.all<Token>("token").map(({ digest: _, ...t }) => t));
  if (path === "/owner/tokens" && method === "POST") {
    const v = z
      .object({ name, scopes: z.array(z.enum(scopes)).min(1).max(3) })
      .strict()
      .parse(await ctx.body(request));
    const raw = secret();
    const t: Token = {
      ...v,
      id: crypto.randomUUID(),
      digest: await digest(raw),
      createdAt: new Date().toISOString(),
      revoked: false,
    };
    ctx.storage.transactionSync(() => {
      ctx.store.put("token", t);
      ctx.store.dirty();
    });
    const { digest: _, ...safe } = t;
    return json({ ...safe, secret: raw }, 201);
  }
  const tm = path.match(/^\/owner\/tokens\/([a-f0-9-]+)$/);
  if (tm && method === "PATCH") {
    z.object({ revoked: z.literal(true) })
      .strict()
      .parse(await ctx.body(request));
    const t = ctx.store.get<Token>("token", tm[1]);
    t.revoked = true;
    ctx.store.put("token", t);
    return json({ id: t.id, revoked: true });
  }
  if (path === "/owner/connections" && method === "GET")
    return json({
      allowedHosts: allowedHosts(ctx.env.WEBHOOK_ALLOWED_HOSTS),
      subscriptions: ctx.store
        .all<Subscription>("subscription")
        .map(({ secret: _, ...s }) => s),
    });
  if (path === "/owner/subscriptions" && method === "POST") {
    const v = z
      .object({
        name,
        url: z.string().max(limits.webhookUrl),
        families: z
          .array(z.enum(["item", "schema"]))
          .min(1)
          .max(2),
      })
      .strict()
      .parse(await ctx.body(request));
    const s: Subscription = {
      ...v,
      url: receiverUrl(
        v.url,
        allowedHosts(ctx.env.WEBHOOK_ALLOWED_HOSTS),
        u.origin,
      ),
      id: crypto.randomUUID(),
      secret: secret(),
      enabled: true,
      origin: u.origin,
      createdAt: new Date().toISOString(),
    };
    ctx.storage.transactionSync(() => {
      ctx.store.put("subscription", s);
      ctx.store.dirty();
    });
    return json(s, 201);
  }
  const sm = path.match(/^\/owner\/subscriptions\/([a-f0-9-]+)$/);
  if (sm && method === "PATCH") {
    const v = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(await ctx.body(request));
    return ctx.storage.transaction(async () => {
      const s = ctx.store.get<Subscription>("subscription", sm[1]);
      s.enabled = v.enabled;
      if (s.enabled)
        receiverUrl(
          s.url,
          allowedHosts(ctx.env.WEBHOOK_ALLOWED_HOSTS),
          s.origin,
        );
      ctx.store.put("subscription", s);
      await ctx.schedule();
      const { secret: _, ...safe } = s;
      return json(safe);
    });
  }
  if (path === "/owner/deliveries" && method === "GET")
    return json(
      ctx.storage.sql
        .exec<{ data: string }>(
          "SELECT data FROM records WHERE kind='delivery' ORDER BY json_extract(data,'$.updatedAt') DESC,id DESC LIMIT 100",
        )
        .toArray()
        .map((r) => {
          const d = JSON.parse(r.data) as Delivery;
          const s = ctx.store.get<Subscription>(
            "subscription",
            d.subscriptionId,
          );
          return { ...d, destination: s.url };
        }),
    );
  const dm = path.match(/^\/owner\/deliveries\/([a-f0-9-]+)\/retry$/);
  if (dm && method === "POST") {
    z.object({})
      .strict()
      .parse(await ctx.body(request));
    return ctx.storage.transaction(async () => {
      const d = ctx.store.get<Delivery>("delivery", dm[1]);
      requireThat(
        d.state === "failed",
        "not_failed",
        "Only failed deliveries can be retried.",
        409,
      );
      const s = ctx.store.get<Subscription>("subscription", d.subscriptionId);
      requireThat(
        s.enabled,
        "subscription_disabled",
        "Enable the subscription before retrying.",
        409,
      );
      d.cycle++;
      d.attempts = 0;
      d.state = "pending";
      d.due = Date.now();
      d.lease = 0;
      d.updatedAt = new Date().toISOString();
      d.outcome = null;
      ctx.store.put("delivery", d);
      await ctx.schedule();
      return json(d);
    });
  }
  if (path === "/owner/export" && method === "GET") {
    const snap = ctx.storage.transactionSync(() => {
      const bytes = ctx.storage.sql
        .exec<{ bytes: number }>(
          "SELECT coalesce(sum(length(CAST(data AS BLOB))),0) bytes FROM records WHERE kind IN ('type','field','option','item','view')",
        )
        .toArray()[0].bytes;
      requireThat(
        bytes <= limits.snapshotBytes,
        "snapshot_too_large",
        "Snapshot exceeds the 10 MiB portable recovery limit.",
        413,
      );
      const m = ctx.store.meta();
      return {
        version: 1,
        workspace: { id: m.id, schemaRevision: m.schemaRevision },
        types: ctx.store.all<Type>("type"),
        fields: ctx.store.all<Field>("field"),
        options: ctx.store.all<Option>("option"),
        items: ctx.store.all<Item>("item"),
        views: ctx.store.all<View>("view"),
      };
    });
    const text = JSON.stringify(snap);
    requireThat(
      new TextEncoder().encode(text).length <= limits.snapshotBytes,
      "snapshot_too_large",
      "Snapshot exceeds the 10 MiB portable recovery limit.",
      413,
    );
    return new Response(text, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="malleable-workspace.json"',
        "Cache-Control": "no-store",
      },
    });
  }
  if (path === "/owner/restore" && method === "POST") {
    const snapshot = validateSnapshot(
      await ctx.body(request, limits.snapshotBytes),
    );
    return ctx.storage.transaction(async () => {
      requireThat(
        ctx.store.meta().pristine,
        "not_pristine",
        "Restore requires a fresh instance without owner-created data or connections.",
        409,
      );
      ctx.storage.sql.exec("DELETE FROM records WHERE kind NOT IN ('session')");
      ctx.store.setMeta({ ...snapshot.workspace, pristine: false, version: 1 });
      for (const [kind, list] of Object.entries({
        type: snapshot.types,
        field: snapshot.fields,
        option: snapshot.options,
        item: snapshot.items,
        view: snapshot.views,
      }))
        for (const r of list) ctx.store.put(kind, r);
      ctx.store.put("event", {
        version: 1,
        id: crypto.randomUUID(),
        workspaceId: snapshot.workspace.id,
        type: "workspace.restored",
        resourceId: snapshot.workspace.id,
        resourceRevision: snapshot.workspace.schemaRevision,
        occurredAt: new Date().toISOString(),
        actor: "owner",
        data: { id: snapshot.workspace.id },
      } satisfies Event);
      await ctx.schedule();
      return json({ ok: true, workspaceId: snapshot.workspace.id });
    });
  }
  throw new AppError(404, "not_found", "No such owner route.");
}

import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import type { Env } from "../worker";
import {
  AppError,
  requireThat,
  fresh,
  limits,
  scopes,
  name,
  id,
  revision,
  value,
  typeSchema,
  fieldSchema,
  optionSchema,
  itemSchema,
  viewSchema,
  validateValues,
  validateSnapshot,
  type Kind,
  type Resource,
  type Type,
  type Field,
  type Option,
  type Item,
  type View,
  type Meta,
  type Principal,
  type Token,
  type Session,
  type Subscription,
  type Event,
  type Delivery,
} from "../domain/model";
import {
  secret,
  digest,
  signature,
  constantEqual,
  validOwnerKey,
  localHost,
  checkRequestOrigin,
  allowedHosts,
  receiverUrl,
} from "../domain/security";
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
export class Workspace extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS migration (version INTEGER NOT NULL)",
      );
      const current =
        ctx.storage.sql
          .exec<{ version: number }>("SELECT version FROM migration")
          .toArray()[0]?.version ?? 0;
      if (current > 1)
        throw new Error(
          "Unsupported newer schema. Use compatible code; do not downgrade.",
        );
      if (current === 0) {
        const tables = ctx.storage.sql
          .exec<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='records'",
          )
          .toArray();
        if (tables.length) {
          const bookmark = await ctx.storage.getCurrentBookmark();
          await ctx.storage.put("preMigrationBookmark", bookmark);
        }
        ctx.storage.transactionSync(() => {
          ctx.storage.sql.exec(
            "CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id))",
          );
          ctx.storage.sql.exec(
            "CREATE INDEX IF NOT EXISTS item_order ON records(kind,json_extract(data,'$.createdAt'),id)",
          );
          ctx.storage.sql.exec(
            "CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
          );
          ctx.storage.sql.exec(
            "CREATE TABLE IF NOT EXISTS throttles (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)",
          );
          ctx.storage.sql.exec("DELETE FROM migration");
          ctx.storage.sql.exec("INSERT INTO migration VALUES (1)");
          if (!this.metaOptional()) {
            this.setMeta({
              id: crypto.randomUUID(),
              schemaRevision: 1,
              pristine: true,
              version: 1,
            });
            this.put("type", { ...fresh(), name: "Item" });
          }
        });
      }
    });
  }
  private all<T>(kind: string): T[] {
    return this.ctx.storage.sql
      .exec<{ data: string }>(
        "SELECT data FROM records WHERE kind=? ORDER BY id",
        kind,
      )
      .toArray()
      .map((r) => JSON.parse(r.data) as T);
  }
  private get<T>(kind: string, key: string): T {
    const r = this.ctx.storage.sql
      .exec<{ data: string }>(
        "SELECT data FROM records WHERE kind=? AND id=?",
        kind,
        key,
      )
      .toArray()[0];
    if (!r) throw new AppError(404, "not_found", "The resource was not found.");
    return JSON.parse(r.data) as T;
  }
  private put<T extends { id: string }>(kind: string, r: T) {
    this.ctx.storage.sql.exec(
      "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      kind,
      r.id,
      JSON.stringify(r),
    );
  }
  private remove(kind: string, key: string) {
    this.ctx.storage.sql.exec(
      "DELETE FROM records WHERE kind=? AND id=?",
      kind,
      key,
    );
  }
  private metaOptional(): Meta | undefined {
    const r = this.ctx.storage.sql
      .exec<{ data: string }>("SELECT data FROM settings WHERE id='workspace'")
      .toArray()[0];
    return r ? JSON.parse(r.data) : undefined;
  }
  private meta(): Meta {
    return this.metaOptional()!;
  }
  private setMeta(m: Meta) {
    this.ctx.storage.sql.exec(
      "INSERT INTO settings VALUES('workspace',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      JSON.stringify(m),
    );
  }
  private dirty(schema = false) {
    const m = this.meta();
    m.pristine = false;
    if (schema) m.schemaRevision++;
    this.setMeta(m);
  }
  private checkRevision(r: Resource, expected: number) {
    requireThat(
      r.revision === expected,
      "revision_conflict",
      "This record changed. Reload its current revision before retrying.",
      409,
    );
  }
  private authorize(p: Principal, scope?: (typeof scopes)[number]) {
    requireThat(
      p.owner || (!!scope && p.scopes.includes(scope)),
      "insufficient_scope",
      "This operation requires additional access.",
      403,
    );
  }
  private async body(
    request: Request,
    max: number = limits.requestBytes,
  ): Promise<unknown> {
    requireThat(
      request.headers.get("content-type")?.split(";")[0] === "application/json",
      "invalid_json",
      "Send application/json.",
      400,
    );
    const reader = request.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
          await reader.cancel();
          throw new AppError(
            413,
            "request_too_large",
            "Request exceeds the published size limit.",
          );
        }
        chunks.push(value);
      }
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      joined.set(c, offset);
      offset += c.length;
    }
    try {
      return JSON.parse(new TextDecoder().decode(joined));
    } catch {
      throw new AppError(
        400,
        "invalid_json",
        "Request body must be valid JSON.",
      );
    }
  }
  private async principal(request: Request, epoch: string): Promise<Principal> {
    const bearer = request.headers.get("authorization");
    if (bearer) {
      const raw = bearer.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      requireThat(raw, "unauthenticated", "Invalid bearer token.", 401);
      const hash = await digest(raw);
      const row = this.ctx.storage.sql
        .exec<{ data: string }>(
          "SELECT data FROM records WHERE kind='token' AND json_extract(data,'$.digest')=?",
          hash,
        )
        .toArray()[0];
      const t: Token | undefined = row ? JSON.parse(row.data) : undefined;
      requireThat(
        t && !t.revoked,
        "unauthenticated",
        "Token is invalid or revoked.",
        401,
      );
      return { id: t.id, owner: false, scopes: t.scopes };
    }
    const raw = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)workspace_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
    requireThat(raw, "unauthenticated", "Sign in to your workspace.", 401);
    const hash = await digest(raw);
    const row = this.ctx.storage.sql
      .exec<{ data: string }>(
        "SELECT data FROM records WHERE kind='session' AND json_extract(data,'$.digest')=?",
        hash,
      )
      .toArray()[0];
    const s: Session | undefined = row ? JSON.parse(row.data) : undefined;
    requireThat(
      s && s.epoch === epoch && s.expires > Date.now(),
      "unauthenticated",
      "Session expired. Sign in again.",
      401,
    );
    if (!["GET", "HEAD"].includes(request.method))
      requireThat(
        request.headers.get("origin") === new URL(request.url).origin,
        "invalid_origin",
        "Browser mutations require the same Origin.",
        403,
      );
    return { id: "owner", owner: true, scopes };
  }
  private async login(request: Request, epoch: string) {
    requireThat(
      request.headers.get("origin") === new URL(request.url).origin,
      "invalid_origin",
      "Sign in from the workspace origin.",
      403,
    );
    const body = z
      .object({ key: z.string().max(200) })
      .strict()
      .parse(await this.body(request));
    const now = Date.now();
    const client = localHost(new URL(request.url).hostname)
      ? "local"
      : request.cf
        ? (request.headers.get("cf-connecting-ip") ?? "unknown")
        : "unknown";
    const bucket = await digest(client);
    this.ctx.storage.sql.exec("DELETE FROM throttles WHERE expires<?", now);
    for (const [key, max] of [
      [bucket, 10],
      ["all", 100],
    ] as const) {
      const r = this.ctx.storage.sql
        .exec<{ count: number }>("SELECT count FROM throttles WHERE id=?", key)
        .toArray()[0];
      requireThat(
        !r || r.count < max,
        "rate_limited",
        "Too many login attempts. Try again in a minute.",
        429,
      );
    }
    if (!constantEqual(await digest(body.key), epoch)) {
      for (const key of [bucket, "all"])
        this.ctx.storage.sql.exec(
          "INSERT INTO throttles VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1",
          key,
          now + 60000,
        );
      throw new AppError(401, "unauthenticated", "The owner key is incorrect.");
    }
    const raw = secret();
    this.ctx.storage.sql.exec(
      "DELETE FROM records WHERE kind='session' AND json_extract(data,'$.expires')<?",
      now,
    );
    this.put("session", {
      id: crypto.randomUUID(),
      digest: await digest(raw),
      epoch,
      expires: now + 12 * 60 * 60 * 1000,
    } satisfies Session);
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ owner: true }, 200, {
      "Set-Cookie": `workspace_session=${raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`,
    });
  }
  async fetch(request: Request): Promise<Response> {
    try {
      checkRequestOrigin(request);
      requireThat(
        validOwnerKey(this.env.OWNER_KEY),
        "configuration_required",
        "The operator must configure a unique random 32-byte base64url OWNER_KEY.",
        503,
      );
      const epoch = await digest(this.env.OWNER_KEY);
      const u = new URL(request.url);
      const path = u.pathname;
      if (path === "/auth/login" && request.method === "POST")
        return await this.login(request, epoch);
      const p = await this.principal(request, epoch);
      if (path === "/auth/session" && request.method === "GET") {
        this.authorize(p);
        return json({
          owner: true,
          workspace: this.meta(),
          environment: localHost(u.hostname) ? "local" : "hosted",
          apiUrl: u.origin + "/api/v1",
        });
      }
      if (path === "/auth/logout" && request.method === "POST") {
        this.authorize(p);
        const raw = request.headers
          .get("cookie")
          ?.match(/workspace_session=([A-Za-z0-9_-]{43})/)?.[1];
        if (raw)
          this.ctx.storage.sql.exec(
            "DELETE FROM records WHERE kind='session' AND json_extract(data,'$.digest')=?",
            await digest(raw),
          );
        return json({ ok: true }, 200, {
          "Set-Cookie": `workspace_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${u.protocol === "https:" ? "; Secure" : ""}`,
        });
      }
      if (path.startsWith("/owner/")) {
        this.authorize(p);
        return await this.ownerRoute(request, u, p);
      }
      if (path === "/api/v1/capabilities" && request.method === "GET") {
        this.authorize(p, "workspace:read");
        return json({
          workspaceId: this.meta().id,
          apiVersion: 1,
          schemaRevision: this.meta().schemaRevision,
          eventVersion: 1,
          fieldKinds: ["text", "number", "checkbox", "select"],
          operations: ["read", "create", "update", "archive", "restore"],
          limits,
        });
      }
      if (path === "/api/v1/schema" && request.method === "GET") {
        this.authorize(p, "workspace:read");
        return json({
          revision: this.meta().schemaRevision,
          types: this.all<Type>("type"),
          fields: this.all<Field>("field"),
          options: this.all<Option>("option"),
        });
      }
      const match = path.match(
        /^\/api\/v1\/(types|fields|options|items)(?:\/([a-f0-9-]+))?$/,
      );
      if (match) {
        const kind = (
          {
            types: "type",
            fields: "field",
            options: "option",
            items: "item",
          } as const
        )[match[1] as "types" | "fields" | "options" | "items"];
        const key = match[2];
        if (key) id.parse(key);
        if (request.method === "GET" && kind === "item") {
          this.authorize(p, "workspace:read");
          return json(key ? this.get<Item>("item", key) : this.listItems(u));
        }
        if (
          (request.method === "POST" && !key) ||
          (request.method === "PATCH" && key)
        ) {
          this.authorize(p, kind === "item" ? "items:write" : "schema:write");
          const input = await this.body(request);
          const result = await this.mutate(kind, key, input, p);
          return json(result, key ? 200 : 201);
        }
      }
      throw new AppError(404, "not_found", "No such API route.");
    } catch (error) {
      if (error instanceof AppError)
        return json(
          { error: { code: error.code, message: error.message } },
          error.status,
        );
      if (error instanceof z.ZodError)
        return json(
          {
            error: {
              code: "validation_failed",
              message: "Some values are invalid.",
              details: error.issues.map((i) => ({
                path: i.path,
                message: i.message,
              })),
            },
          },
          422,
        );
      return json(
        {
          error: {
            code: "internal_error",
            message:
              "An unexpected error occurred. Retry or contact the operator.",
          },
        },
        500,
      );
    }
  }
  private listItems(u: URL) {
    const search = z
      .string()
      .max(1000)
      .parse(u.searchParams.get("q") ?? "")
      .toLowerCase();
    const type = u.searchParams.get("typeId") ?? "";
    if (type) id.parse(type);
    const archive = z
      .enum(["true", "false"])
      .parse(u.searchParams.get("archived") ?? "false");
    const size = z.coerce
      .number()
      .int()
      .min(1)
      .max(limits.pageSize)
      .parse(u.searchParams.get("limit") ?? 50);
    const filter = JSON.stringify([search, type, archive]);
    let afterTime = "",
      afterId = "";
    const cursor = u.searchParams.get("cursor");
    if (cursor) {
      try {
        const c = z
          .object({ filter: z.string(), time: z.string().datetime(), id })
          .strict()
          .parse(
            JSON.parse(
              new TextDecoder().decode(
                Uint8Array.from(atob(cursor), (c) => c.charCodeAt(0)),
              ),
            ),
          );
        requireThat(
          c.filter === filter,
          "invalid_cursor",
          "Cursor does not match filters.",
          400,
        );
        afterTime = c.time;
        afterId = c.id;
      } catch {
        throw new AppError(
          400,
          "invalid_cursor",
          "Cursor is invalid or does not match filters.",
        );
      }
    }
    const rows: Item[] = [];
    let scanTime = afterTime,
      scanId = afterId;
    while (rows.length <= size) {
      const batch = this.ctx.storage.sql
        .exec<{ data: string }>(
          `SELECT data FROM records WHERE kind='item' AND (?='true' OR json_extract(data,'$.archived')=0) AND (?='' OR json_extract(data,'$.typeId')=?) AND (json_extract(data,'$.createdAt')>? OR (json_extract(data,'$.createdAt')=? AND id>?)) ORDER BY json_extract(data,'$.createdAt'),id LIMIT 100`,
          archive,
          type,
          type,
          scanTime,
          scanTime,
          scanId,
        )
        .toArray()
        .map((r) => JSON.parse(r.data) as Item);
      for (const i of batch) {
        if ((i.title + " " + i.body).toLowerCase().includes(search))
          rows.push(i);
        if (rows.length > size) break;
      }
      if (rows.length > size || batch.length < 100) break;
      const end = batch.at(-1)!;
      scanTime = end.createdAt;
      scanId = end.id;
    }
    const items = rows.slice(0, size),
      last = items.at(-1);
    const nextCursor =
      rows.length > size && last
        ? btoa(
            String.fromCharCode(
              ...new TextEncoder().encode(
                JSON.stringify({ filter, time: last.createdAt, id: last.id }),
              ),
            ),
          )
        : null;
    return { items, nextCursor };
  }

  private async mutate(
    kind: Kind,
    key: string | undefined,
    input: unknown,
    p: Principal,
  ): Promise<Resource> {
    return this.ctx.storage.transaction(async () => {
      const old = key ? this.get<Resource>(kind, key) : undefined;
      let result: Resource;
      const common = old
        ? {
            ...old,
            revision: old.revision + 1,
            updatedAt: new Date().toISOString(),
          }
        : fresh();
      const patch = old
        ? z.object({ revision }).passthrough().parse(input)
        : undefined;
      if (old) this.checkRevision(old, patch!.revision);
      if (kind === "type") {
        const v = (
          old
            ? z.object({ revision, name: name.optional() })
            : z.object({ name })
        )
          .strict()
          .parse(input);
        result = typeSchema.parse({
          ...common,
          ...("name" in v && v.name ? { name: v.name } : {}),
        });
      } else if (kind === "field") {
        const v = (
          old
            ? z.object({
                revision,
                name: name.optional(),
                archived: z.boolean().optional(),
              })
            : z.object({
                typeId: id,
                name,
                kind: z.enum(["text", "number", "checkbox", "select"]),
              })
        )
          .strict()
          .parse(input);
        if (!old) {
          this.get("type", (v as { typeId: string }).typeId);
          requireThat(
            this.all<Field>("field").filter(
              (f) => f.typeId === (v as { typeId: string }).typeId,
            ).length < limits.fieldsPerType,
            "field_limit",
            "This type has the maximum number of fields.",
          );
        }
        const { revision: ignored, ...data } = v as Record<string, unknown>;
        result = fieldSchema.parse({
          ...common,
          ...(!old ? { archived: false } : {}),
          ...data,
        });
      } else if (kind === "option") {
        const v = (
          old
            ? z.object({ revision, name: name.optional() })
            : z.object({ fieldId: id, name })
        )
          .strict()
          .parse(input);
        if (!old) {
          const f = this.get<Field>(
            "field",
            (v as { fieldId: string }).fieldId,
          );
          requireThat(
            f.kind === "select" && !f.archived,
            "invalid_field",
            "Options require an active select field.",
          );
          requireThat(
            this.all<Option>("option").filter((o) => o.fieldId === f.id)
              .length < limits.optionsPerField,
            "option_limit",
            "This field has the maximum number of options.",
          );
        } else {
          const f = this.get<Field>("field", (old as Option).fieldId);
          requireThat(
            !f.archived,
            "archived_field",
            "Restore the field before editing its options.",
          );
        }
        const { revision: ignored, ...data } = v as Record<string, unknown>;
        result = optionSchema.parse({ ...common, ...data });
      } else if (kind === "item") {
        const v = (
          old
            ? z.object({
                revision,
                title: name.optional(),
                body: z.string().max(limits.body).optional(),
                values: z.record(id, value.nullable()).optional(),
                archived: z.boolean().optional(),
              })
            : z.object({
                typeId: id,
                title: name,
                body: z.string().max(limits.body).default(""),
                values: z.record(id, value).default({}),
              })
        )
          .strict()
          .parse(input);
        if (!old) this.get("type", (v as { typeId: string }).typeId);
        const prior = old as Item | undefined;
        const merged = { ...prior?.values };
        for (const [k, val] of Object.entries(v.values ?? {})) {
          if (val === null) delete merged[k];
          else merged[k] = val;
        }
        const {
          revision: ignored,
          values: ignoredValues,
          ...data
        } = v as Record<string, unknown>;
        result = itemSchema.parse({
          ...common,
          ...(!old ? { archived: false } : {}),
          ...data,
          values: merged,
        });
        validateValues(
          result as Item,
          this.all<Field>("field"),
          this.all<Option>("option"),
          Object.keys(v.values ?? {}),
        );
      } else {
        const v = (
          old
            ? z.object({
                revision,
                mode: z.enum(["list", "board"]),
                typeId: id.nullable(),
                fieldId: id.nullable(),
              })
            : z.object({
                mode: z.enum(["list", "board"]),
                typeId: id.nullable(),
                fieldId: id.nullable(),
              })
        )
          .strict()
          .parse(input);
        if (v.typeId) this.get("type", v.typeId);
        if (v.fieldId) {
          const f = this.get<Field>("field", v.fieldId);
          requireThat(
            f.typeId === v.typeId && f.kind === "select" && !f.archived,
            "invalid_grouping",
            "Select an active select field for this type.",
          );
        }
        requireThat(
          v.mode !== "board" || v.fieldId,
          "invalid_grouping",
          "A board needs a grouping field.",
        );
        const { revision: ignored, ...data } = v as Record<string, unknown>;
        result = viewSchema.parse({ ...common, ...data });
      }
      this.put(kind, result);
      this.dirty(kind !== "item" && kind !== "view");
      if (kind !== "view") {
        const action = !old
          ? "created"
          : "archived" in result &&
              "archived" in old &&
              result.archived !== old.archived
            ? result.archived
              ? "archived"
              : "restored"
            : "updated";
        await this.emit(`${kind}.${action}`, result, p.id);
      }
      return result;
    });
  }
  private async emit(type: string, r: Resource, actor: string) {
    const e: Event = {
      version: 1,
      id: crypto.randomUUID(),
      workspaceId: this.meta().id,
      type,
      resourceId: r.id,
      resourceRevision: r.revision,
      occurredAt: new Date().toISOString(),
      actor,
      data: r,
    };
    this.put("event", e);
    const family = type.startsWith("item.") ? "item" : "schema";
    for (const s of this.all<Subscription>("subscription").filter(
      (s) => s.enabled && s.families.includes(family),
    )) {
      const now = Date.now();
      this.put("delivery", {
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
    await this.schedule();
  }
  private async schedule() {
    const row = this.ctx.storage.sql
      .exec<{ due: number }>(
        `SELECT min(CASE WHEN json_extract(d.data,'$.state')='inflight' THEN json_extract(d.data,'$.lease') ELSE json_extract(d.data,'$.due') END) AS due FROM records d JOIN records s ON s.kind='subscription' AND s.id=json_extract(d.data,'$.subscriptionId') WHERE d.kind='delivery' AND json_extract(d.data,'$.state') IN ('pending','inflight') AND json_extract(s.data,'$.enabled')=1`,
      )
      .toArray()[0];
    if (row?.due != null)
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, row.due));
    else await this.ctx.storage.deleteAlarm();
  }
  private async ownerRoute(
    request: Request,
    u: URL,
    p: Principal,
  ): Promise<Response> {
    const path = u.pathname,
      method = request.method;
    if (path === "/owner/views" && method === "GET")
      return json(this.all<View>("view"));
    const vm = path.match(/^\/owner\/views(?:\/([a-f0-9-]+))?$/);
    if (vm && ((method === "POST" && !vm[1]) || (method === "PATCH" && vm[1])))
      return json(
        await this.mutate("view", vm[1], await this.body(request), p),
        vm[1] ? 200 : 201,
      );
    if (path === "/owner/tokens" && method === "GET")
      return json(this.all<Token>("token").map(({ digest: _, ...t }) => t));
    if (path === "/owner/tokens" && method === "POST") {
      const v = z
        .object({ name, scopes: z.array(z.enum(scopes)).min(1).max(3) })
        .strict()
        .parse(await this.body(request));
      const raw = secret();
      const t: Token = {
        ...v,
        id: crypto.randomUUID(),
        digest: await digest(raw),
        createdAt: new Date().toISOString(),
        revoked: false,
      };
      this.ctx.storage.transactionSync(() => {
        this.put("token", t);
        this.dirty();
      });
      const { digest: _, ...safe } = t;
      return json({ ...safe, secret: raw }, 201);
    }
    const tm = path.match(/^\/owner\/tokens\/([a-f0-9-]+)$/);
    if (tm && method === "PATCH") {
      z.object({ revoked: z.literal(true) })
        .strict()
        .parse(await this.body(request));
      const t = this.get<Token>("token", tm[1]);
      t.revoked = true;
      this.put("token", t);
      return json({ id: t.id, revoked: true });
    }
    if (path === "/owner/connections" && method === "GET")
      return json({
        allowedHosts: allowedHosts(this.env.WEBHOOK_ALLOWED_HOSTS),
        subscriptions: this.all<Subscription>("subscription").map(
          ({ secret: _, ...s }) => s,
        ),
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
        .parse(await this.body(request));
      const s: Subscription = {
        ...v,
        url: receiverUrl(
          v.url,
          allowedHosts(this.env.WEBHOOK_ALLOWED_HOSTS),
          u.origin,
        ),
        id: crypto.randomUUID(),
        secret: secret(),
        enabled: true,
        origin: u.origin,
        createdAt: new Date().toISOString(),
      };
      this.ctx.storage.transactionSync(() => {
        this.put("subscription", s);
        this.dirty();
      });
      return json(s, 201);
    }
    const sm = path.match(/^\/owner\/subscriptions\/([a-f0-9-]+)$/);
    if (sm && method === "PATCH") {
      const v = z
        .object({ enabled: z.boolean() })
        .strict()
        .parse(await this.body(request));
      return this.ctx.storage.transaction(async () => {
        const s = this.get<Subscription>("subscription", sm[1]);
        s.enabled = v.enabled;
        if (s.enabled)
          receiverUrl(
            s.url,
            allowedHosts(this.env.WEBHOOK_ALLOWED_HOSTS),
            s.origin,
          );
        this.put("subscription", s);
        await this.schedule();
        const { secret: _, ...safe } = s;
        return json(safe);
      });
    }
    if (path === "/owner/deliveries" && method === "GET")
      return json(
        this.ctx.storage.sql
          .exec<{ data: string }>(
            "SELECT data FROM records WHERE kind='delivery' ORDER BY json_extract(data,'$.updatedAt') DESC,id DESC LIMIT 100",
          )
          .toArray()
          .map((r) => {
            const d = JSON.parse(r.data) as Delivery;
            const s = this.get<Subscription>("subscription", d.subscriptionId);
            return { ...d, destination: s.url };
          }),
      );
    const dm = path.match(/^\/owner\/deliveries\/([a-f0-9-]+)\/retry$/);
    if (dm && method === "POST") {
      z.object({})
        .strict()
        .parse(await this.body(request));
      return this.ctx.storage.transaction(async () => {
        const d = this.get<Delivery>("delivery", dm[1]);
        requireThat(
          d.state === "failed",
          "not_failed",
          "Only failed deliveries can be retried.",
          409,
        );
        const s = this.get<Subscription>("subscription", d.subscriptionId);
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
        this.put("delivery", d);
        await this.schedule();
        return json(d);
      });
    }
    if (path === "/owner/export" && method === "GET") {
      const snap = this.ctx.storage.transactionSync(() => {
        const bytes = this.ctx.storage.sql
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
        const m = this.meta();
        return {
          version: 1,
          workspace: { id: m.id, schemaRevision: m.schemaRevision },
          types: this.all<Type>("type"),
          fields: this.all<Field>("field"),
          options: this.all<Option>("option"),
          items: this.all<Item>("item"),
          views: this.all<View>("view"),
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
        await this.body(request, limits.snapshotBytes),
      );
      return this.ctx.storage.transaction(async () => {
        requireThat(
          this.meta().pristine,
          "not_pristine",
          "Restore requires a fresh instance without owner-created data or connections.",
          409,
        );
        this.ctx.storage.sql.exec(
          "DELETE FROM records WHERE kind NOT IN ('session')",
        );
        this.setMeta({ ...snapshot.workspace, pristine: false, version: 1 });
        for (const [kind, list] of Object.entries({
          type: snapshot.types,
          field: snapshot.fields,
          option: snapshot.options,
          item: snapshot.items,
          view: snapshot.views,
        }))
          for (const r of list) this.put(kind, r);
        this.put("event", {
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
        await this.schedule();
        return json({ ok: true, workspaceId: snapshot.workspace.id });
      });
    }
    throw new AppError(404, "not_found", "No such owner route.");
  }
  async alarm() {
    const jobs = await this.ctx.storage.transaction(async () => {
      const now = Date.now();
      const expired = this.ctx.storage.sql
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
        this.put("delivery", d);
      }
      const due = this.ctx.storage.sql
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
          this.put("delivery", d);
          continue;
        }
        d.state = "inflight";
        d.attempts++;
        d.totalAttempts++;
        d.lease = now + 15000;
        d.updatedAt = new Date().toISOString();
        this.put("delivery", d);
        this.put("attempt", {
          id: `${d.id}.${d.totalAttempts}`,
          deliveryId: d.id,
          cycle: d.cycle,
          slot: d.attempts,
          startedAt: d.updatedAt,
          outcome: "inflight",
        });
        reserved.push(d);
      }
      await this.schedule();
      return reserved;
    });
    await Promise.all(
      jobs.map(async (job) => {
        let outcome = "network_error",
          success = false;
        try {
          const s = this.get<Subscription>("subscription", job.subscriptionId);
          requireThat(
            s.enabled,
            "subscription_disabled",
            "Subscription disabled.",
          );
          const url = receiverUrl(
            s.url,
            allowedHosts(this.env.WEBHOOK_ALLOWED_HOSTS),
            s.origin,
          );
          const row = this.ctx.storage.sql
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
        await this.ctx.storage.transaction(async () => {
          const d = this.get<Delivery>("delivery", job.id);
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
          this.put("delivery", d);
          this.put("attempt", {
            id: `${d.id}.${d.totalAttempts}`,
            deliveryId: d.id,
            cycle: d.cycle,
            slot: d.attempts,
            startedAt: job.updatedAt,
            finishedAt: d.updatedAt,
            outcome,
          });
          await this.schedule();
        });
      }),
    );
  }
}

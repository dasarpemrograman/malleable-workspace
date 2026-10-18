import { z } from "zod";

import {
  AppError,
  requireThat,
  fresh,
  limits,
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
  type Kind,
  type Resource,
  type Type,
  type Field,
  type Option,
  type Item,
  type Principal,
} from "../domain/model";
import {
  digest,
  validOwnerKey,
  localHost,
  checkRequestOrigin,
} from "../domain/security";

import { json } from "./http";
import type { WorkspaceContext } from "./context";

export async function fetch(
  ctx: Pick<
    WorkspaceContext,
    | "authorize"
    | "body"
    | "env"
    | "listItems"
    | "login"
    | "mutate"
    | "ownerRoute"
    | "principal"
    | "storage"
    | "store"
  >,
  request: Request,
): Promise<Response> {
  try {
    checkRequestOrigin(request);
    requireThat(
      validOwnerKey(ctx.env.OWNER_KEY),
      "configuration_required",
      "The operator must configure a unique random 32-byte base64url OWNER_KEY.",
      503,
    );
    const epoch = await digest(ctx.env.OWNER_KEY);
    const u = new URL(request.url);
    const path = u.pathname;
    if (path === "/auth/login" && request.method === "POST")
      return await ctx.login(request, epoch);
    const p = await ctx.principal(request, epoch);
    if (path === "/auth/session" && request.method === "GET") {
      ctx.authorize(p);
      return json({
        owner: true,
        workspace: ctx.store.meta(),
        environment: localHost(u.hostname) ? "local" : "hosted",
        apiUrl: u.origin + "/api/v1",
      });
    }
    if (path === "/auth/logout" && request.method === "POST") {
      ctx.authorize(p);
      const raw = request.headers
        .get("cookie")
        ?.match(/workspace_session=([A-Za-z0-9_-]{43})/)?.[1];
      if (raw)
        ctx.storage.sql.exec(
          "DELETE FROM records WHERE kind='session' AND json_extract(data,'$.digest')=?",
          await digest(raw),
        );
      return json({ ok: true }, 200, {
        "Set-Cookie": `workspace_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${u.protocol === "https:" ? "; Secure" : ""}`,
      });
    }
    if (path.startsWith("/owner/")) {
      ctx.authorize(p);
      return await ctx.ownerRoute(request, u, p);
    }
    if (path === "/api/v1/capabilities" && request.method === "GET") {
      ctx.authorize(p, "workspace:read");
      return json({
        workspaceId: ctx.store.meta().id,
        apiVersion: 1,
        schemaRevision: ctx.store.meta().schemaRevision,
        eventVersion: 1,
        fieldKinds: ["text", "number", "checkbox", "select"],
        operations: ["read", "create", "update", "archive", "restore"],
        limits,
      });
    }
    if (path === "/api/v1/schema" && request.method === "GET") {
      ctx.authorize(p, "workspace:read");
      return json({
        revision: ctx.store.meta().schemaRevision,
        types: ctx.store.all<Type>("type"),
        fields: ctx.store.all<Field>("field"),
        options: ctx.store.all<Option>("option"),
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
        ctx.authorize(p, "workspace:read");
        return json(key ? ctx.store.get<Item>("item", key) : ctx.listItems(u));
      }
      if (
        (request.method === "POST" && !key) ||
        (request.method === "PATCH" && key)
      ) {
        ctx.authorize(p, kind === "item" ? "items:write" : "schema:write");
        const input = await ctx.body(request);
        const result = await ctx.mutate(kind, key, input, p);
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

export function listItems(ctx: Pick<WorkspaceContext, "storage">, u: URL) {
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
    const batch = ctx.storage.sql
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
      if ((i.title + " " + i.body).toLowerCase().includes(search)) rows.push(i);
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

export async function mutate(
  ctx: Pick<WorkspaceContext, "emit" | "storage" | "store">,
  kind: Kind,
  key: string | undefined,
  input: unknown,
  p: Principal,
): Promise<Resource> {
  return ctx.storage.transaction(async () => {
    const old = key ? ctx.store.get<Resource>(kind, key) : undefined;
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
    if (old) ctx.store.checkRevision(old, patch!.revision);
    if (kind === "type") {
      const v = (
        old ? z.object({ revision, name: name.optional() }) : z.object({ name })
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
        ctx.store.get("type", (v as { typeId: string }).typeId);
        requireThat(
          ctx.store
            .all<Field>("field")
            .filter((f) => f.typeId === (v as { typeId: string }).typeId)
            .length < limits.fieldsPerType,
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
        const f = ctx.store.get<Field>(
          "field",
          (v as { fieldId: string }).fieldId,
        );
        requireThat(
          f.kind === "select" && !f.archived,
          "invalid_field",
          "Options require an active select field.",
        );
        requireThat(
          ctx.store.all<Option>("option").filter((o) => o.fieldId === f.id)
            .length < limits.optionsPerField,
          "option_limit",
          "This field has the maximum number of options.",
        );
      } else {
        const f = ctx.store.get<Field>("field", (old as Option).fieldId);
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
      if (!old) ctx.store.get("type", (v as { typeId: string }).typeId);
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
        ctx.store.all<Field>("field"),
        ctx.store.all<Option>("option"),
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
      if (v.typeId) ctx.store.get("type", v.typeId);
      if (v.fieldId) {
        const f = ctx.store.get<Field>("field", v.fieldId);
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
    ctx.store.put(kind, result);
    ctx.store.dirty(kind !== "item" && kind !== "view");
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
      await ctx.emit(`${kind}.${action}`, result, p.id);
    }
    return result;
  });
}

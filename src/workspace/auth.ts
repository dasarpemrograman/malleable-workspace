import { z } from "zod";

import {
  AppError,
  requireThat,
  limits,
  scopes,
  id,
  value,
  type Principal,
  type Token,
  type Session,
} from "../domain/model";
import { secret, digest, constantEqual, localHost } from "../domain/security";

import { json } from "./http";
import type { WorkspaceContext } from "./context";

export function authorize(
  ctx: Pick<WorkspaceContext, never>,
  p: Principal,
  scope?: (typeof scopes)[number],
) {
  requireThat(
    p.owner || (!!scope && p.scopes.includes(scope)),
    "insufficient_scope",
    "This operation requires additional access.",
    403,
  );
}

export async function body(
  ctx: Pick<WorkspaceContext, never>,
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
    throw new AppError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

export async function principal(
  ctx: Pick<WorkspaceContext, "storage">,
  request: Request,
  epoch: string,
): Promise<Principal> {
  const bearer = request.headers.get("authorization");
  if (bearer) {
    const raw = bearer.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    requireThat(raw, "unauthenticated", "Invalid bearer token.", 401);
    const hash = await digest(raw);
    const row = ctx.storage.sql
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
  const row = ctx.storage.sql
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

export async function login(
  ctx: Pick<WorkspaceContext, "body" | "storage" | "store">,
  request: Request,
  epoch: string,
) {
  requireThat(
    request.headers.get("origin") === new URL(request.url).origin,
    "invalid_origin",
    "Sign in from the workspace origin.",
    403,
  );
  const body = z
    .object({ key: z.string().max(200) })
    .strict()
    .parse(await ctx.body(request));
  const now = Date.now();
  const client = localHost(new URL(request.url).hostname)
    ? "local"
    : request.cf
      ? (request.headers.get("cf-connecting-ip") ?? "unknown")
      : "unknown";
  const bucket = await digest(client);
  ctx.storage.sql.exec("DELETE FROM throttles WHERE expires<?", now);
  for (const [key, max] of [
    [bucket, 10],
    ["all", 100],
  ] as const) {
    const r = ctx.storage.sql
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
      ctx.storage.sql.exec(
        "INSERT INTO throttles VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1",
        key,
        now + 60000,
      );
    throw new AppError(401, "unauthenticated", "The owner key is incorrect.");
  }
  const raw = secret();
  ctx.storage.sql.exec(
    "DELETE FROM records WHERE kind='session' AND json_extract(data,'$.expires')<?",
    now,
  );
  ctx.store.put("session", {
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

import {
  Miniflare,
  convertV4MiniflareOptions,
  type V4MiniflareOptions,
} from "miniflare";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
export const key = randomBytes(32).toString("base64url");
export const mfOptions = {
  modules: true,
  scriptPath: ".worker/test.js",
  compatibilityDate: "2026-10-17",
  compatibilityFlags: ["global_fetch_strictly_public"],
  durableObjects: {
    WORKSPACE: { className: "TestWorkspace", useSQLite: true },
  },
  bindings: {
    OWNER_KEY: key,
    WEBHOOK_ALLOWED_HOSTS: '["receiver.example.com"]',
  },
};
type Row = Record<string, unknown>;
type Stub = {
  testSQL: (sql: string, ...args: (string | number | null)[]) => Promise<Row[]>;
  testAlarm: () => Promise<void>;
  testClearAlarm: () => Promise<void>;
};
export function harness(options: Record<string, unknown> = {}) {
  return new Miniflare(
    convertV4MiniflareOptions({
      ...mfOptions,
      ...options,
    } as V4MiniflareOptions),
  );
}
export async function dispatch(
  mf: Miniflare,
  input: string,
  init: Record<string, unknown> = {},
) {
  const h = new Headers(init.headers as HeadersInit);
  h.set("x-fixture-host", h.get("host") ?? new URL(input).host);
  return mf.dispatchFetch(input, { ...init, headers: Object.fromEntries(h) });
}

export async function owner(
  mf: Miniflare,
  origin = "http://localhost",
  ownerKey = key,
) {
  const r = await dispatch(mf, origin + "/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ key: ownerKey }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return async (path: string, method = "GET", body?: unknown) => {
    const response = await dispatch(mf, origin + path, {
      method,
      headers: {
        cookie,
        Origin: origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: (await response.json()) as any,
      headers: response.headers,
    };
  };
}
export async function stub(mf: Miniflare) {
  const env = await mf.getBindings<{
    WORKSPACE: { getByName: (n: string) => Stub };
  }>();
  return env.WORKSPACE.getByName("primary");
}

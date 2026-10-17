import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Miniflare,
  convertV4MiniflareOptions,
  type V4MiniflareOptions,
} from "miniflare";
import { randomBytes, createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const key = randomBytes(32).toString("base64url");
const mfOptions = {
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
function harness(options: Record<string, unknown> = {}) {
  return new Miniflare(
    convertV4MiniflareOptions({
      ...mfOptions,
      ...options,
    } as V4MiniflareOptions),
  );
}
async function dispatch(
  mf: Miniflare,
  input: string,
  init: Record<string, unknown> = {},
) {
  const h = new Headers(init.headers as HeadersInit);
  h.set("x-fixture-host", h.get("host") ?? new URL(input).host);
  return mf.dispatchFetch(input, { ...init, headers: Object.fromEntries(h) });
}

async function owner(
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
async function stub(mf: Miniflare) {
  const env = await mf.getBindings<{
    WORKSPACE: { getByName: (n: string) => Stub };
  }>();
  return env.WORKSPACE.getByName("primary");
}
const validTitle = (title = "First") => ({ title });
test("stable identities, all field kinds, archives, conflicts, rollback and bounded pagination", async () => {
  const mf = harness();
  try {
    const req = await owner(mf);
    const schema = (await req("/api/v1/schema")).data;
    assert.equal(schema.types.length, 1);
    assert.equal(schema.fields.length, 0);
    const type = schema.types[0];
    const fields: Record<string, any> = {};
    for (const kind of ["text", "number", "checkbox", "select"]) {
      const r = await req("/api/v1/fields", "POST", {
        typeId: type.id,
        name: kind,
        kind,
      });
      assert.equal(r.status, 201);
      fields[kind] = r.data;
    }
    const option = (
      await req("/api/v1/options", "POST", {
        fieldId: fields.select.id,
        name: "Soon",
      })
    ).data;
    const values = {
      [fields.text.id]: "hello",
      [fields.number.id]: 0,
      [fields.checkbox.id]: false,
      [fields.select.id]: option.id,
    };
    let item = (
      await req("/api/v1/items", "POST", {
        typeId: type.id,
        title: "Research",
        body: "A curious question",
        values,
      })
    ).data;
    assert.deepEqual(item.values, values);
    for (const [kind, r] of [
      ["types", type],
      ["fields", fields.select],
      ["options", option],
    ] as const) {
      const renamed = await req("/api/v1/" + kind + "/" + r.id, "PATCH", {
        revision: r.revision,
        name: "Renamed " + kind,
      });
      assert.equal(renamed.status, 200);
      assert.equal(renamed.data.id, r.id);
    }
    item = (
      await req("/api/v1/items/" + item.id, "PATCH", {
        revision: item.revision,
        title: "Updated by original ID",
      })
    ).data;
    assert.deepEqual(item.values, values);
    assert.equal(
      (
        await req("/api/v1/items/" + item.id, "PATCH", {
          revision: 1,
          title: "Stale",
        })
      ).status,
      409,
    );
    const bad = await req("/api/v1/items/" + item.id, "PATCH", {
      revision: item.revision,
      title: "Should not save",
      values: { [fields.number.id]: "bad" },
    });
    assert.equal(bad.status, 422);
    assert.equal(
      (await req("/api/v1/items/" + item.id)).data.title,
      item.title,
    );
    const a = await req("/api/v1/fields/" + fields.number.id, "PATCH", {
      revision: 1,
      archived: true,
    });
    assert.equal(a.status, 200);
    assert.equal(
      (
        await req("/api/v1/items/" + item.id, "PATCH", {
          revision: item.revision,
          values: { [fields.number.id]: 2 },
        })
      ).data.error.code,
      "archived_field",
    );
    assert.equal(
      (
        await req("/api/v1/fields/" + fields.number.id, "PATCH", {
          revision: 2,
          archived: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await req("/api/v1/items/" + item.id)).data.values[fields.number.id],
      0,
    );
    assert.equal(
      (
        await req("/api/v1/fields/" + fields.text.id, "PATCH", {
          revision: 1,
          kind: "number",
        })
      ).status,
      422,
    );
    const st = await stub(mf);
    await st.testSQL(
      "CREATE TRIGGER fail_event BEFORE INSERT ON records WHEN NEW.kind='event' BEGIN SELECT RAISE(ABORT,'injected'); END;",
    );
    const count = (
      await st.testSQL("SELECT count(*) n FROM records WHERE kind='event'")
    )[0].n;
    assert.equal(
      (
        await req("/api/v1/items/" + item.id, "PATCH", {
          revision: item.revision,
          title: "Rollback",
        })
      ).status,
      500,
    );
    assert.equal(
      (await req("/api/v1/items/" + item.id)).data.title,
      item.title,
    );
    assert.equal(
      (await st.testSQL("SELECT count(*) n FROM records WHERE kind='event'"))[0]
        .n,
      count,
    );
    await st.testSQL("DROP TRIGGER fail_event");
    const second = (
      await req("/api/v1/items", "POST", { typeId: type.id, title: "Second" })
    ).data;
    await st.testSQL(
      "UPDATE records SET data=json_set(data,'$.createdAt','2026-10-17T00:00:00.000Z') WHERE kind='item'",
    );
    const firstPage = (await req("/api/v1/items?limit=1")).data;
    const page2 = (
      await req(
        "/api/v1/items?limit=1&cursor=" +
          encodeURIComponent(firstPage.nextCursor),
      )
    ).data;
    assert.notEqual(firstPage.items[0].id, page2.items[0].id);
    assert.equal(page2.nextCursor, null);
    assert.equal(
      (
        await req(
          "/api/v1/items?q=other&limit=1&cursor=" +
            encodeURIComponent(firstPage.nextCursor),
        )
      ).status,
      400,
    );
    assert.equal((await req("/api/v1/items?limit=101")).status, 422);
    assert.equal(
      (
        await req("/api/v1/items", "POST", {
          typeId: type.id,
          title: "x".repeat(241),
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await req("/api/v1/items/" + second.id, "PATCH", {
          revision: second.revision,
          archived: true,
        })
      ).status,
      200,
    );
    assert.equal((await req("/api/v1/items")).data.items.length, 1);
    assert.equal(
      (
        await req("/api/v1/items/" + second.id, "PATCH", {
          revision: 2,
          archived: false,
        })
      ).status,
      200,
    );
  } finally {
    await mf.dispose();
  }
});
test("authentication, scopes, origin, hosted cookie semantics, key rotation and throttling", async () => {
  const mf = harness();
  try {
    assert.equal(
      (await dispatch(mf, "http://localhost/api/v1/schema")).status,
      401,
    );
    const req = await owner(mf, "https://workspace.example.com");
    const l = await dispatch(mf, "https://workspace.example.com/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://workspace.example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key }),
    });
    assert.match(l.headers.get("set-cookie")!, /Secure/);
    assert.match(l.headers.get("set-cookie")!, /HttpOnly/);
    const cookie = l.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await dispatch(mf, "https://workspace.example.com/owner/tokens", {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await dispatch(mf, "https://workspace.example.com/api/v1/schema", {
          headers: { Cookie: cookie, Origin: "https://evil.example.com" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await dispatch(mf, "https://workspace.example.com/api/v1/schema", {
          headers: { Cookie: cookie, Host: "evil.example.com" },
        })
      ).status,
      403,
    );
    const t = (
      await req("/owner/tokens", "POST", {
        name: "Reader",
        scopes: ["workspace:read"],
      })
    ).data;
    assert.ok(t.secret);
    assert.equal((await req("/owner/tokens")).data[0].digest, undefined);
    assert.equal((await req("/owner/tokens")).data[0].secret, undefined);
    const call = (path: string, method = "GET", data?: unknown) =>
      dispatch(mf, "https://workspace.example.com" + path, {
        method,
        headers: {
          Authorization: "Bearer " + t.secret,
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
      });
    assert.equal((await call("/api/v1/schema")).status, 200);
    assert.equal((await call("/owner/tokens")).status, 403);
    assert.equal(
      (await call("/api/v1/items", "POST", { title: "no" })).status,
      403,
    );
    await req("/owner/tokens/" + t.id, "PATCH", { revoked: true });
    assert.equal((await call("/api/v1/schema")).status, 401);
    await mf.setOptions(
      convertV4MiniflareOptions({
        ...mfOptions,
        bindings: {
          ...mfOptions.bindings,
          OWNER_KEY: randomBytes(32).toString("base64url"),
        },
      }),
    );
    assert.equal(
      (
        await dispatch(mf, "https://workspace.example.com/api/v1/schema", {
          headers: { Cookie: cookie },
        })
      ).status,
      401,
    );
  } finally {
    await mf.dispose();
  }
  const locked = harness({
    bindings: { OWNER_KEY: "REPLACE_WITH_A_RANDOM_32_BYTE_BASE64URL_KEY" },
  });
  try {
    assert.equal(
      (await dispatch(locked, "https://x.example.com/api/v1/schema")).status,
      503,
    );
  } finally {
    await locked.dispose();
  }
  const limited = harness();
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await dispatch(limited, "http://localhost/auth/login", {
            method: "POST",
            headers: {
              Origin: "http://localhost",
              "Content-Type": "application/json",
              "CF-Connecting-IP": String(i),
            },
            body: JSON.stringify({ key: "wrong" }),
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await dispatch(limited, "http://localhost/auth/login", {
          method: "POST",
          headers: {
            Origin: "http://localhost",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key: "wrong" }),
        })
      ).status,
      429,
    );
  } finally {
    await limited.dispose();
  }
});
test("persistent local state, isolated instances, portable restore and credential exclusion", async () => {
  const dir = await mkdtemp(join(tmpdir(), "malleable-test-"));
  let mf = harness({ resourcePersistencePath: dir });
  let snapshot: any;
  try {
    let req = await owner(mf);
    let s = (await req("/api/v1/schema")).data;
    const t = s.types[0];
    await req("/api/v1/items", "POST", { typeId: t.id, title: "Persistent" });
    await req("/owner/views", "POST", {
      mode: "list",
      typeId: t.id,
      fieldId: null,
    });
    const token = (
      await req("/owner/tokens", "POST", {
        name: "Old",
        scopes: ["workspace:read"],
      })
    ).data;
    snapshot = (await req("/owner/export")).data;
    assert.equal(snapshot.tokens, undefined);
    assert.equal(snapshot.sessions, undefined);
    assert.equal(snapshot.subscriptions, undefined);
    const wid = (await req("/api/v1/capabilities")).data.workspaceId;
    await mf.dispose();
    mf = harness({ resourcePersistencePath: dir });
    req = await owner(mf);
    assert.equal((await req("/api/v1/capabilities")).data.workspaceId, wid);
    assert.equal(
      (await req("/api/v1/items")).data.items[0].title,
      "Persistent",
    );
    assert.equal((await req("/owner/restore", "POST", snapshot)).status, 409);
    const other = harness();
    try {
      const r = await owner(other, "https://target.example.com");
      assert.notEqual((await r("/api/v1/capabilities")).data.workspaceId, wid);
      const invalid = structuredClone(snapshot);
      invalid.items[0].typeId = crypto.randomUUID();
      assert.equal((await r("/owner/restore", "POST", invalid)).status, 422);
      assert.equal((await r("/owner/restore", "POST", snapshot)).status, 200);
      assert.equal((await r("/api/v1/capabilities")).data.workspaceId, wid);
      assert.equal(
        (await r("/api/v1/items")).data.items[0].id,
        snapshot.items[0].id,
      );
      assert.equal((await r("/owner/tokens")).data.length, 0);
      assert.equal(
        (
          await dispatch(other, "https://target.example.com/api/v1/schema", {
            headers: { Authorization: "Bearer " + token.secret },
          })
        ).status,
        401,
      );
    } finally {
      await other.dispose();
    }
  } finally {
    await mf.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
test("signed webhooks, family selection, duplicate alarms, budgets, disable and retry", async () => {
  const received: {
    body: string;
    timestamp: string;
    sig: string;
    id: string;
  }[] = [];
  let status = 503;
  const mf = harness({
    outboundService: async (request: Request) => {
      received.push({
        body: await request.text(),
        timestamp: request.headers.get("x-workspace-timestamp")!,
        sig: request.headers.get("x-workspace-signature")!,
        id: request.headers.get("x-workspace-event-id")!,
      });
      return new Response("", { status });
    },
  });
  try {
    const req = await owner(mf);
    const st = await stub(mf);
    assert.equal(
      (
        await req("/owner/subscriptions", "POST", {
          name: "No",
          url: "https://127.0.0.1/hook",
          families: ["item"],
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await req("/owner/subscriptions", "POST", {
          name: "No",
          url: "https://unknown.example.com/hook",
          families: ["item"],
        })
      ).status,
      422,
    );
    const sub = (
      await req("/owner/subscriptions", "POST", {
        name: "Receiver",
        url: "https://receiver.example.com/hook",
        families: ["item"],
      })
    ).data;
    const type = (await req("/api/v1/schema")).data.types[0];
    await req("/api/v1/types/" + type.id, "PATCH", {
      revision: 1,
      name: "Thought",
    });
    assert.equal((await req("/owner/deliveries")).data.length, 0);
    const item = (
      await req("/api/v1/items", "POST", {
        typeId: type.id,
        title: "Send this",
      })
    ).data;
    await st.testClearAlarm();
    await st.testAlarm();
    await st.testClearAlarm();
    let d = (await req("/owner/deliveries")).data[0];
    assert.equal(d.attempts, 1);
    assert.equal(received.length, 1);
    assert.equal(
      received[0].sig,
      "sha256=" +
        createHmac("sha256", sub.secret)
          .update(received[0].timestamp + "." + received[0].body)
          .digest("hex"),
    );
    assert.equal(JSON.parse(received[0].body).resourceId, item.id);
    assert.ok(!received[0].body.includes(sub.secret));
    await st.testAlarm();
    await st.testClearAlarm();
    assert.equal(received.length, 1);
    for (let i = 0; i < 2; i++) {
      await st.testSQL(
        "UPDATE records SET data=json_set(data,'$.due',0) WHERE kind='delivery'",
      );
      await st.testAlarm();
      await st.testClearAlarm();
    }
    d = (await req("/owner/deliveries")).data[0];
    assert.equal(d.attempts, 3);
    assert.equal(d.state, "failed");
    await st.testAlarm();
    await st.testClearAlarm();
    assert.equal(received.length, 3);
    assert.ok(
      received.every(
        (r) => r.id === received[0].id && r.body === received[0].body,
      ),
    );
    status = 200;
    await req("/owner/deliveries/" + d.id + "/retry", "POST", {});
    await st.testClearAlarm();
    await st.testAlarm();
    await st.testClearAlarm();
    d = (await req("/owner/deliveries")).data[0];
    assert.equal(d.state, "succeeded");
    assert.equal(d.totalAttempts, 4);
    assert.equal(d.attempts, 1);
    assert.equal(received[3].id, received[0].id);
    await req("/owner/subscriptions/" + sub.id, "PATCH", { enabled: false });
    await req("/api/v1/items/" + item.id, "PATCH", {
      revision: item.revision,
      title: "No new delivery",
    });
    assert.equal((await req("/owner/deliveries")).data.length, 1);
  } finally {
    await mf.dispose();
  }
});
test("write-only/schema-only scopes, JSON routing, Unicode search, and byte limits", async () => {
  const mf = harness();
  try {
    const req = await owner(mf),
      type = (await req("/api/v1/schema")).data.types[0];
    const write = (
      await req("/owner/tokens", "POST", {
        name: "Writer",
        scopes: ["items:write"],
      })
    ).data;
    const schemaToken = (
      await req("/owner/tokens", "POST", {
        name: "Schema editor",
        scopes: ["schema:write"],
      })
    ).data;
    const tool = (
      token: string,
      path: string,
      method = "GET",
      data?: unknown,
    ) =>
      dispatch(mf, "http://localhost" + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    assert.equal((await tool(write.secret, "/api/v1/schema")).status, 403);
    assert.equal(
      (
        await tool(write.secret, "/api/v1/items", "POST", {
          typeId: type.id,
          title: "ÉLAN 中文",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await tool(schemaToken.secret, "/api/v1/types", "POST", {
          name: "Another",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await tool(schemaToken.secret, "/api/v1/items", "POST", {
          typeId: type.id,
          title: "No",
        })
      ).status,
      403,
    );
    await req("/api/v1/items", "POST", {
      typeId: type.id,
      title: "ÉLAN 中文 second",
    });
    const page1 = (
      await req(
        "/api/v1/items?q=" + encodeURIComponent("ÉLAN 中文") + "&limit=1",
      )
    ).data;
    assert.equal(page1.items.length, 1);
    assert.ok(page1.nextCursor);
    const page2 = (
      await req(
        "/api/v1/items?q=" +
          encodeURIComponent("élan 中文") +
          "&limit=1&cursor=" +
          encodeURIComponent(page1.nextCursor),
      )
    ).data;
    assert.equal(page2.items.length, 1);
    assert.notEqual(page1.items[0].id, page2.items[0].id);
    assert.equal((await req("/api/v1/unknown")).status, 404);
    const huge = await tool(write.secret, "/api/v1/items", "POST", {
      typeId: type.id,
      title: "Too big",
      body: "x".repeat(1048577),
    });
    assert.equal(huge.status, 413);
  } finally {
    await mf.dispose();
  }
});
test("newer application schemas refuse initialization without deleting persisted content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "malleable-schema-"));
  let mf = harness({ resourcePersistencePath: dir });
  try {
    const req = await owner(mf),
      type = (await req("/api/v1/schema")).data.types[0];
    await req("/api/v1/items", "POST", {
      typeId: type.id,
      title: "Keep across upgrade",
    });
    await (await stub(mf)).testSQL("UPDATE migration SET version=999");
    await mf.dispose();
    mf = harness({ resourcePersistencePath: dir });
    let rejected = false;
    try {
      const r = await dispatch(mf, "http://localhost/api/v1/schema");
      rejected = r.status >= 500;
      await r.text();
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true);
  } finally {
    await mf.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
test("local item and schema work needs no outbound network service", async () => {
  let networkCalls = 0;
  const mf = harness({
    outboundService: async () => {
      networkCalls++;
      throw new Error("Offline");
    },
  });
  try {
    const req = await owner(mf);
    const t = (await req("/api/v1/types", "POST", { name: "Offline ideas" }))
      .data;
    const f = (
      await req("/api/v1/fields", "POST", {
        typeId: t.id,
        name: "Reference",
        kind: "text",
      })
    ).data;
    const i = await req("/api/v1/items", "POST", {
      typeId: t.id,
      title: "Works without internet",
      values: { [f.id]: "local" },
    });
    assert.equal(i.status, 201);
    assert.equal(
      (await req("/api/v1/items/" + i.data.id)).data.values[f.id],
      "local",
    );
    assert.equal(networkCalls, 0);
  } finally {
    await mf.dispose();
  }
});
test("documented external client example runs against a real local HTTP listener", async () => {
  const mf = harness();
  try {
    const origin = (await mf.ready).origin;
    const req = await owner(mf, origin);
    const token = (
      await req("/owner/tokens", "POST", {
        name: "Example runner",
        scopes: ["workspace:read", "items:write"],
      })
    ).data;
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const result = await promisify(execFile)(
      process.execPath,
      ["examples/roundtrip.mjs"],
      {
        env: {
          ...process.env,
          WORKSPACE_URL: origin,
          WORKSPACE_TOKEN: token.secret,
        },
      },
    );
    const reported = JSON.parse(result.stdout);
    assert.equal(reported.title, "Connected from an external tool");
    assert.equal((await req("/api/v1/items/" + reported.itemId)).status, 200);
    assert.ok(!result.stdout.includes(token.secret));
  } finally {
    await mf.dispose();
  }
});

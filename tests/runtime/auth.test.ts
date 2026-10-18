import { convertV4MiniflareOptions } from "miniflare";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { harness, dispatch, owner, key, mfOptions } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

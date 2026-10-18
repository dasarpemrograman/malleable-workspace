import { test } from "node:test";
import assert from "node:assert/strict";

import { harness, dispatch, owner } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

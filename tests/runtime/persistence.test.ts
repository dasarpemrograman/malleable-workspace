import { test } from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { harness, dispatch, owner } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

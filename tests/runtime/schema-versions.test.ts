import { test } from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { harness, dispatch, owner, stub } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

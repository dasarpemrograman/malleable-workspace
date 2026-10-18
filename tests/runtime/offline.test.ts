import { test } from "node:test";
import assert from "node:assert/strict";

import { harness, owner } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

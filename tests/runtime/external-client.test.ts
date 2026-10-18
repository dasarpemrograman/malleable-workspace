import { test } from "node:test";
import assert from "node:assert/strict";

import { harness, owner } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

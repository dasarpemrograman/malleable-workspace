import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { harness, owner, stub } from "../helpers/runtime";
const validTitle = (title = "First") => ({ title });
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

test(
  "a late receipt cannot overwrite a newer delivery cycle",
  { timeout: 20000 },
  async () => {
    let release!: () => void;
    let observed!: () => void;
    const receipt = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      observed = resolve;
    });
    const mf = harness({
      outboundService: async () => {
        observed();
        await receipt;
        return new Response("", { status: 200 });
      },
    });
    try {
      const req = await owner(mf);
      const st = await stub(mf);
      await req("/owner/subscriptions", "POST", {
        name: "Slow receiver",
        url: "https://receiver.example.com/hook",
        families: ["item"],
      });
      const type = (await req("/api/v1/schema")).data.types[0];
      await req("/api/v1/items", "POST", {
        typeId: type.id,
        title: "Receipt race",
      });
      await st.testClearAlarm();
      const alarm = st.testAlarm();
      await started;
      await st.testSQL(
        "UPDATE records SET data=json_set(data,'$.cycle',2,'$.state','pending','$.attempts',0,'$.lease',0,'$.due',?) WHERE kind='delivery'",
        Date.now() + 60000,
      );
      release();
      await alarm;
      const delivery = (await req("/owner/deliveries")).data[0];
      assert.equal(delivery.cycle, 2);
      assert.equal(delivery.state, "pending");
      assert.equal(delivery.attempts, 0);
      assert.equal(delivery.totalAttempts, 1);
      const attempts = await st.testSQL(
        "SELECT data FROM records WHERE kind='attempt'",
      );
      assert.equal(attempts.length, 1);
      // Reservation is retained for audit; the stale receipt cannot mark it successful.
      assert.equal(JSON.parse(attempts[0].data as string).outcome, "inflight");
      await st.testClearAlarm();
    } finally {
      release();
      await mf.dispose();
    }
  },
);

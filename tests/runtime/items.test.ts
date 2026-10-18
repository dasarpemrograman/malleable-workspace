import { test } from "node:test";
import assert from "node:assert/strict";

import { harness, owner, stub } from "../helpers/runtime";
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

import { parse, type ParseError } from "jsonc-parser";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac, randomBytes } from "node:crypto";
import {
  receiverUrl,
  validOwnerKey,
  checkRequestOrigin,
} from "../src/domain/security";
import { validateSnapshot, fresh } from "../src/domain/model";
// @ts-expect-error The example is deliberately native JavaScript for external tools.
import { verifyWebhook } from "../examples/verify-webhook.mjs";
test("destination and owner bootstrap policy rejects ambiguous URLs and placeholders", () => {
  const hosts = [
    "receiver.example.com",
    "localhost",
    "127.0.0.1",
    "private.local",
    "[::1]",
  ];
  for (const url of [
    "https://127.0.0.1/hook",
    "http://receiver.example.com",
    "https://receiver.example.com:8443",
    "https://user:pass@receiver.example.com",
    "https://receiver.example.com/#secret",
    "https://localhost/",
    "https://private.local/",
    "https://[::1]/",
    "https://no.example.com/",
  ])
    assert.throws(() =>
      receiverUrl(url, hosts, "https://workspace.example.com"),
    );
  assert.equal(
    receiverUrl(
      "https://receiver.example.com/hook",
      hosts,
      "https://workspace.example.com",
    ),
    "https://receiver.example.com/hook",
  );
  assert.throws(() =>
    receiverUrl(
      "https://workspace.example.com/",
      ["workspace.example.com"],
      "https://workspace.example.com",
    ),
  );
  assert.equal(
    validOwnerKey("REPLACE_WITH_A_RANDOM_32_BYTE_BASE64URL_KEY"),
    false,
  );
  assert.equal(validOwnerKey(randomBytes(32).toString("base64url")), true);
  assert.equal(validOwnerKey("a".repeat(43)), false);
  assert.throws(() =>
    checkRequestOrigin(
      new Request("http://127.0.0.1/api/v1/schema", {
        headers: { host: "evil.example.com" },
      }),
    ),
  );
});
test("receiver example authenticates bytes and rejects replay timestamps", () => {
  const secret = randomBytes(32).toString("base64url"),
    timestamp = String(Math.floor(Date.now() / 1000)),
    body = Buffer.from('{"id":"event"}');
  const signature =
    "sha256=" +
    createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(body)
      .digest("hex");
  assert.equal(verifyWebhook({ secret, timestamp, signature, body }), true);
  assert.equal(
    verifyWebhook({
      secret,
      timestamp,
      signature,
      body: Buffer.from("modified"),
    }),
    false,
  );
  assert.equal(
    verifyWebhook({
      secret,
      timestamp,
      signature,
      body,
      now: Number(timestamp) + 301,
    }),
    false,
  );
  assert.equal(
    verifyWebhook({ secret, timestamp, signature: "bad", body }),
    false,
  );
});
test("snapshot reference validation preserves unset/false/zero and rejects invalid recovery", () => {
  const type = { ...fresh(), name: "Item" },
    f = {
      ...fresh(),
      typeId: type.id,
      name: "Count",
      kind: "number",
      archived: false,
    };
  const item = {
    ...fresh(),
    typeId: type.id,
    title: "A",
    body: "",
    values: { [f.id]: 0 },
    archived: false,
  };
  const snapshot = {
    version: 1,
    workspace: { id: crypto.randomUUID(), schemaRevision: 1 },
    types: [type],
    fields: [f],
    options: [],
    items: [item],
    views: [],
  };
  assert.equal(validateSnapshot(snapshot).items[0].values[f.id], 0);
  for (const mutation of [
    (s: any) => (s.version = 2),
    (s: any) => (s.items[0].typeId = crypto.randomUUID()),
    (s: any) => (s.items[0].values[f.id] = "wrong"),
    (s: any) => (s.items[0].id = type.id),
  ]) {
    const copy = structuredClone(snapshot);
    mutation(copy);
    assert.throws(() => validateSnapshot(copy));
  }
});
test("public API contract, template declarations, secret boundaries and source-dependent badge", async () => {
  const spec = JSON.parse(await readFile("docs/openapi.json", "utf8"));
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/items/{id}"].patch.requestBody);
  assert.ok(spec.paths["/fields/{id}"].patch.requestBody);
  assert.equal(Object.keys(spec.paths).length, 10);
  const configErrors: ParseError[] = [];
  const config = parse(await readFile("wrangler.jsonc", "utf8"), configErrors, {
    allowTrailingComma: true,
  });
  assert.equal(configErrors.length, 0);
  assert.deepEqual(config.migrations, [
    { tag: "v1", new_sqlite_classes: ["Workspace"] },
  ]);
  assert.equal(config.durable_objects.bindings.length, 1);
  assert.equal(config.vars.WEBHOOK_ALLOWED_HOSTS, "[]");
  assert.ok(
    config.compatibility_flags.includes("global_fetch_strictly_public"),
  );
  assert.equal(config.assets.directory, "dist");
  assert.equal(config.OWNER_KEY, undefined);
  assert.ok(!JSON.stringify(config).includes("remote"));
  const readme = await readFile("README.md", "utf8");
  const deployLink = readme.match(
    /https:\/\/deploy\.workers\.cloudflare\.com\/\?url=[^)]+/,
  );
  assert.ok(deployLink);
  assert.equal(
    new URL(deployLink[0]).searchParams.get("url"),
    "https://github.com/dasarpemrograman/malleable-workspace",
  );
  assert.ok(!readme.includes("deploy.workers.cloudflare.com/?url=OWNER"));
  const production = await readFile(".worker/index.js", "utf8");
  assert.ok(!production.includes("testSQL"));
  assert.ok(!production.includes("testAlarm"));
});

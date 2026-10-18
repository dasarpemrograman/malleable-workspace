import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// @ts-expect-error Native JavaScript operator tooling.
import * as deployment from "../scripts/lib/deployment.mjs";
const {
  deployWorkspace,
  checkDestination,
  retainProviderSettings,
  jsonResponse,
} = deployment;
const enrollment = {
  version: 1,
  accountId: "a".repeat(32),
  namespaceId: "b".repeat(32),
  workerName: "personal",
  bindingName: "WORKSPACE",
  className: "Workspace",
  objectName: "primary",
  productionBranch: "main",
  migrations: [{ tag: "v1", new_sqlite_classes: ["Workspace"] }],
};
const config = {
  name: "personal",
  main: "src/index.ts",
  assets: { directory: "dist" },
  durable_objects: {
    bindings: [{ name: "WORKSPACE", class_name: "Workspace" }],
  },
  migrations: enrollment.migrations,
  vars: { WEBHOOK_ALLOWED_HOSTS: "[]" },
};
const provider = {
  resources: {
    bindings: [
      {
        type: "durable_object_namespace",
        name: "WORKSPACE",
        class_name: "Workspace",
        namespace_id: enrollment.namespaceId,
      },
      { type: "secret_text", name: "OWNER_KEY" },
      {
        type: "plain_text",
        name: "WEBHOOK_ALLOWED_HOSTS",
        text: '["receiver.example"]',
      },
    ],
  },
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "deployment-test-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "dist"));
  mkdirSync(join(root, ".workspace"));
  writeFileSync(
    join(root, "src/index.ts"),
    'env.WORKSPACE.getByName("primary");',
  );
  writeFileSync(join(root, "wrangler.jsonc"), JSON.stringify(config));
  writeFileSync(
    join(root, ".workspace/deployment.json"),
    JSON.stringify(enrollment),
  );
  return root;
}

test("enrolled upgrade keeps dashboard settings and resolves paths; failed validation never uploads", () => {
  const root = fixture();
  try {
    let calls = 0;
    const result = deployWorkspace({
      root,
      env: {},
      dryRun: true,
      inspect: () => provider,
      check: () => {},
      upload: (args: string[]) => {
        calls++;
        const generated = JSON.parse(
          readFileSync(args[args.indexOf("--config") + 1]!, "utf8"),
        );
        assert.equal(generated.vars, undefined);
        assert.equal(generated.keep_vars, true);
        assert.equal(generated.main, join(root, "src/index.ts"));
        assert.equal(generated.assets.directory, join(root, "dist"));
        assert.equal(generated.preview_urls, false);
        assert.equal(generated.account_id, enrollment.accountId);
        assert.ok(args.includes("--keep-vars"));
        assert.ok(args.includes("--dry-run"));
      },
    });
    assert.equal(result.deployed, false);
    assert.equal(calls, 1);
    assert.throws(() =>
      deployWorkspace({
        root,
        env: {},
        inspect: () => provider,
        check: () => {
          throw Error("build failed");
        },
        upload: () => calls++,
      }),
    );
    assert.equal(calls, 1);
    assert.throws(() =>
      deployWorkspace({
        root,
        env: {},
        inspect: () => {
          throw Error("read denied");
        },
        check: () => {},
        upload: () => calls++,
      }),
    );
    assert.equal(calls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("destination, routing, migrations, preview and provider drift block before upload", () => {
  const root = fixture();
  try {
    for (const cfg of [
      { ...config, name: "wrong" },
      { ...config, migrations: [] },
      {
        ...config,
        migrations: [
          ...enrollment.migrations,
          { tag: "v2", deleted_classes: ["Workspace"] },
        ],
      },
      {
        ...config,
        durable_objects: {
          bindings: [{ name: "OTHER", class_name: "Workspace" }],
        },
      },
    ])
      assert.throws(() => checkDestination(root, cfg, enrollment, {}));
    for (const env of [
      { WRANGLER_CI_OVERRIDE_NAME: "wrong" },
      { CLOUDFLARE_ACCOUNT_ID: "c".repeat(32) },
      { WORKERS_CI_BRANCH: "preview" },
      { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/pull/1/merge" },
    ])
      assert.throws(() => checkDestination(root, config, enrollment, env));
    assert.deepEqual(
      checkDestination(
        root,
        {
          ...config,
          migrations: [
            ...enrollment.migrations,
            { tag: "v2", new_sqlite_classes: ["Extra"] },
          ],
        },
        enrollment,
        {},
      ),
      [{ tag: "v2", new_sqlite_classes: ["Extra"] }],
    );
    writeFileSync(
      join(root, "src/index.ts"),
      'env.WORKSPACE.getByName("other");',
    );
    assert.throws(() => checkDestination(root, config, enrollment, {}));
    const bad = structuredClone(provider);
    bad.resources.bindings[0]!.namespace_id = "c".repeat(32);
    assert.throws(() => retainProviderSettings(config, enrollment, bad));
    assert.throws(
      () =>
        retainProviderSettings(
          {
            ...config,
            vars: { WEBHOOK_ALLOWED_HOSTS: '["different.example"]' },
          },
          enrollment,
          provider,
        ),
      (e: any) =>
        e.code === "configuration_drift" &&
        !JSON.stringify(e).includes("receiver.example"),
    );
    assert.throws(() =>
      retainProviderSettings(
        { ...config, vars: { NEW_SETTING: "value" } },
        enrollment,
        provider,
      ),
    );
    assert.throws(() =>
      retainProviderSettings(config, enrollment, {
        resources: {
          bindings: provider.resources.bindings.filter(
            (b) => b.type !== "secret_text",
          ),
        },
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fresh setup works without provider access; imported copies require enrollment", () => {
  const root = fixture();
  try {
    rmSync(join(root, ".workspace/deployment.json"));
    let uploaded = 0;
    deployWorkspace({
      root,
      env: {},
      dryRun: true,
      check: () => {},
      inspect: () => {
        throw Error("unexpected provider call");
      },
      upload: () => uploaded++,
    });
    assert.equal(uploaded, 1);
    writeFileSync(
      join(root, ".workspace/upstream.json"),
      JSON.stringify({
        version: 1,
        repository: "example/source",
        ref: "main",
        importedCommit: "a".repeat(40),
      }),
    );
    assert.throws(
      () =>
        deployWorkspace({
          root,
          env: {},
          check: () => {},
          upload: () => uploaded++,
        }),
      (e: any) => e.code === "enrollment_required",
    );
    assert.equal(uploaded, 1);
    assert.deepEqual(jsonResponse('Wrangler info\n[{"id":"ok"}]\n'), [
      { id: "ok" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

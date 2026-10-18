import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { symlinkSync } from "node:fs";
import { parse } from "yaml";
// @ts-expect-error Native JavaScript contributor tooling.
import * as development from "../scripts/dev.mjs";
// @ts-expect-error Native JavaScript contributor tooling.
import * as suites from "../scripts/test.mjs";

async function port() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

test("focused suites partition recursive test discovery without omissions or duplicate execution", () => {
  const root = mkdtempSync(join(tmpdir(), "suite-discovery-"));
  try {
    mkdirSync(join(root, "runtime"));
    for (const file of [
      "contracts.test.ts",
      "tool.test.ts",
      "runtime/auth.test.ts",
      "browser.spec.ts",
    ])
      writeFileSync(join(root, file), "");
    const all = suites.testFiles("all", root);
    const focused = ["contracts", "runtime", "operators"].flatMap((name) =>
      suites.testFiles(name, root),
    );
    assert.deepEqual([...focused].sort(), all);
    assert.equal(new Set(focused).size, 3);
    assert.throws(() => suites.testFiles("missing", root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("development gates Worker startup on a valid build, recovers errors and cleans up on child failure", async () => {
  const watcher = new EventEmitter() as EventEmitter & {
    close: () => Promise<void>;
  };
  let closed = 0,
    started = 0,
    hooks: any;
  watcher.close = async () => {
    closed++;
  };
  let child: ReturnType<typeof spawn> | undefined;
  const controller = await development.startDev({
    port: await port(),
    buildClient: async (options: any) => {
      hooks = options.plugins[0];
      return watcher;
    },
    spawnWorker: () => {
      started++;
      child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        detached: process.platform !== "win32",
        stdio: "ignore",
      });
      return child;
    },
  });
  try {
    assert.equal(started, 0);
    watcher.emit("event", {
      code: "ERROR",
      error: Error("fixture syntax failure"),
    });
    assert.equal(started, 0);
    hooks.writeBundle();
    hooks.writeBundle();
    assert.equal(started, 1);
    child!.kill("SIGTERM");
    assert.equal(await controller.finished, 1);
    assert.equal(closed, 1);
  } finally {
    await controller.close();
  }
});

test("development rejects occupied ports and an interrupted initial build leaves no watcher", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const occupied = (server.address() as { port: number }).port;
  try {
    await assert.rejects(development.availablePort(occupied), /occupied/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await development.availablePort(occupied);
  await assert.rejects(development.availablePort(0), /MW_DEV_PORT/);
  const abort = new AbortController();
  let disposed = 0;
  const watcher = new EventEmitter() as any;
  watcher.close = async () => {
    disposed++;
  };
  const controller = await development.startDev({
    port: occupied,
    signal: abort.signal,
    buildClient: async () => {
      abort.abort();
      return watcher;
    },
    spawnWorker: () => {
      throw Error("Worker started before a valid build");
    },
  });
  assert.equal(await controller.finished, 0);
  assert.equal(disposed, 1);
});

test("format check reports malformed maintained source without modifying source or local state", () => {
  const file = "src/contributor-format-probe.ts";
  const content = "export const probe={value:1}\n";
  try {
    writeFileSync(file, content, { flag: "wx" });
    const result = spawnSync(
      process.execPath,
      ["scripts/format.mjs", "--check"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /contributor-format-probe/);
    assert.equal(readFileSync(file, "utf8"), content);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /\.dev\.vars|\.wrangler\/state/,
    );
  } finally {
    rmSync(file, { force: true });
  }
});

test("ordinary CI uses immutable Actions and read-only checks with a trusted explicit-SHA dispatch", () => {
  const text = readFileSync(".github/workflows/ci.yml", "utf8");
  const ci = parse(text);
  assert.deepEqual(Object.keys(ci.on).sort(), [
    "pull_request",
    "push",
    "workflow_dispatch",
  ]);
  assert.deepEqual(ci.permissions, { contents: "read" });
  assert.deepEqual(ci.jobs.select.permissions, {});
  const selection = ci.jobs.select.steps[0].run;
  assert.match(selection, /refs\/heads\/main/);
  assert.match(selection, /\^\[0-9a-f\]\{40\}\$/);
  for (const job of [ci.jobs.core, ci.jobs.browser]) {
    assert.equal(job.needs, "select");
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[a-f0-9]{40}$/);
      if (step.uses?.startsWith("actions/checkout")) {
        assert.equal(step.with["persist-credentials"], false);
        assert.equal(step.with.ref, "${{ needs.select.outputs.ref }}");
      }
    }
  }
  assert.doesNotMatch(
    text,
    /secrets\.|pull_request_target|contents: write|npm run deploy|wrangler deploy/,
  );
  assert.match(JSON.stringify(ci.jobs.core), /npm run check/);
  assert.match(JSON.stringify(ci.jobs.browser), /test:browser/);
  const artifact = ci.jobs.browser.steps.find((step: any) =>
    step.uses?.startsWith("actions/upload-artifact"),
  );
  assert.equal(artifact.with.path, "test-results/**/*.png");
});

test(
  "the real Vite/Wrangler supervisor releases its port on Ctrl-C",
  { timeout: 30000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "supervisor-integration-"));
    const selected = await port();
    symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
    writeFileSync(join(root, ".dev.vars"), "TEST_ONLY=local\n", {
      mode: 0o600,
    });
    writeFileSync(
      join(root, "index.html"),
      '<script type="module" src="/client.js"></script>',
    );
    writeFileSync(join(root, "client.js"), 'console.log("fixture");');
    writeFileSync(
      join(root, "worker.js"),
      'export default {fetch(){return new Response("supervised");}};',
    );
    writeFileSync(
      join(root, "wrangler.jsonc"),
      JSON.stringify({
        name: "supervisor-fixture",
        main: "worker.js",
        compatibility_date: "2026-10-17",
      }),
    );
    const child = spawn(process.execPath, [resolve("scripts/dev.mjs")], {
      cwd: root,
      env: {
        ...process.env,
        MW_DEV_PORT: String(selected),
        XDG_CONFIG_HOME: join(root, "config"),
        WRANGLER_LOG_PATH: join(root, "wrangler.log"),
        WRANGLER_SEND_METRICS: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output = (output + data).slice(-4000);
    });
    child.stderr.on("data", (data) => {
      output = (output + data).slice(-4000);
    });
    const exited = new Promise<number | null>((resolve) =>
      child.once("exit", resolve),
    );
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw Error(output);
        try {
          ready =
            (await (await fetch(`http://127.0.0.1:${selected}`)).text()) ===
            "supervised";
        } catch {
          /* wait for startup */
        }
        if (ready) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(ready, output);
      child.kill("SIGINT");
      assert.equal(await exited, 0, output);
      await development.availablePort(selected);
      assert.equal(
        readFileSync(join(root, ".dev.vars"), "utf8"),
        "TEST_ONLY=local\n",
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGINT");
        await exited;
      }
      rmSync(root, { recursive: true, force: true });
    }
  },
);

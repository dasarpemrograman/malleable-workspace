import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// @ts-expect-error Operator tooling is native JavaScript, executable without compilation.
import * as updater from "../scripts/lib/git-update.mjs";
// @ts-expect-error Operator tooling is native JavaScript.
import * as model from "../scripts/lib/update-model.mjs";
const { prepareUpdate, git, matchBaseline } = updater;
const { upstreamSchema, deploymentSchema, validateMigrations } = model;

function write(root: string, path: string, text: string | Buffer) {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
}
function commit(repo: string, message: string) {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", message]);
  return git(repo, ["rev-parse", "HEAD"]).trim();
}
function init(repo: string) {
  mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "fixture"]);
  git(repo, ["config", "user.email", "fixture@example.invalid"]);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "workspace-upstream-test-"));
  const upstream = join(root, "upstream"),
    downstream = join(root, "downstream");
  init(upstream);
  const config = {
    name: "upstream",
    main: "src/worker/index.ts",
    compatibility_date: "2026-10-17",
    assets: { directory: "dist", binding: "ASSETS" },
    durable_objects: {
      bindings: [{ name: "WORKSPACE", class_name: "Workspace" }],
    },
    migrations: [{ tag: "v1", new_sqlite_classes: ["Workspace"] }],
    vars: { WEBHOOK_ALLOWED_HOSTS: "[]" },
  };
  write(upstream, "wrangler.jsonc", JSON.stringify(config, null, 2) + "\n");
  write(
    upstream,
    "package.json",
    JSON.stringify({ name: "upstream", version: "0.1.0" }, null, 2) + "\n",
  );
  write(
    upstream,
    "src/worker/index.ts",
    'export default {fetch(r, env){return env.WORKSPACE.getByName("primary").fetch(r)}};\n',
  );
  write(
    upstream,
    "app.txt",
    Array.from({ length: 100 }, (_, i) => `Line ${i}`).join("\n") + "\n",
  );
  write(upstream, "remove.txt", "Remove this upstream\n");
  write(upstream, "rename.txt", "Stable rename content\n");
  const baseline = commit(upstream, "Original template");
  init(downstream);
  for (const file of git(upstream, ["ls-tree", "-r", "--name-only", baseline])
    .trim()
    .split("\n")) {
    write(downstream, file, git(upstream, ["show", `${baseline}:${file}`]));
  }
  for (const file of ["package.json", "wrangler.jsonc"]) {
    const value = JSON.parse(readFileSync(join(downstream, file), "utf8"));
    value.name = "personal";
    write(downstream, file, JSON.stringify(value, null, 2) + "\n");
  }
  commit(downstream, "source repo import");
  return {
    root,
    upstream,
    downstream,
    baseline,
    config,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
const prepare = (f: ReturnType<typeof fixture>, extra = {}) =>
  prepareUpdate({
    downstream: f.downstream,
    upstreamPath: f.upstream,
    source: "example/upstream",
    downstreamId: "owner/copy",
    ...extra,
  });

test("strict provenance/enrollment records and migration history reject unsafe input", () => {
  const valid = {
    version: 1,
    repository: "example/upstream",
    ref: "main",
    importedCommit: "a".repeat(40),
  };
  assert.deepEqual(upstreamSchema.parse(valid), valid);
  for (const bad of [
    { ...valid, importedCommit: "main" },
    { ...valid, repository: "https://user:token@github.com/owner/repo" },
    { ...valid, ref: "--upload-pack=bad" },
    { ...valid, ref: "main..other" },
    { ...valid, secret: "never" },
  ])
    assert.throws(() => upstreamSchema.parse(bad));
  assert.throws(() => deploymentSchema.parse({ workerName: "personal" }));
  const previous = [{ tag: "v1", new_sqlite_classes: ["Workspace"] }];
  assert.throws(() => validateMigrations(previous, []));
  assert.throws(() =>
    validateMigrations(previous, [
      ...previous,
      { tag: "v2", deleted_classes: ["Workspace"] },
    ]),
  );
  assert.throws(() =>
    validateMigrations(previous, [...previous, { tag: "v1" }]),
  );
  assert.doesNotThrow(() =>
    validateMigrations(previous, [
      ...previous,
      { tag: "v2", new_sqlite_classes: ["Extra"] },
    ]),
  );
});

test("template import finds unique baseline and retains names, owner edits, modes, binary changes, renames and deletes", () => {
  const f = fixture();
  try {
    write(
      f.downstream,
      "app.txt",
      readFileSync(join(f.downstream, "app.txt"), "utf8").replace(
        "Line 4\n",
        "Owner customization\n",
      ),
    );
    // Establish the verified initial baseline before applying owner customizations.
    const original = git(f.downstream, ["rev-parse", "HEAD"]).trim();
    commit(f.downstream, "Owner edit");
    write(
      f.upstream,
      "app.txt",
      readFileSync(join(f.upstream, "app.txt"), "utf8").replace(
        "Line 80\n",
        "Upstream improvement\n",
      ),
    );
    git(f.upstream, ["mv", "rename.txt", "renamed.txt"]);
    rmSync(join(f.upstream, "remove.txt"));
    write(f.upstream, "image.bin", Buffer.from([0, 255, 1, 2, 0, 254]));
    write(f.upstream, "executable", "#!/bin/sh\nexit 0\n");
    chmodSync(join(f.upstream, "executable"), 0o755);
    const target = commit(f.upstream, "Upstream update");
    const before = git(f.downstream, ["rev-parse", "HEAD"]).trim();
    const result = prepare(f, { baseline: f.baseline, target });
    assert.equal(result.baseline, f.baseline);
    assert.equal(result.target, target);
    assert.equal(git(f.downstream, ["rev-parse", "HEAD"]).trim(), before);
    assert.equal(
      JSON.parse(readFileSync(join(result.candidate, "wrangler.jsonc"), "utf8"))
        .name,
      "personal",
    );
    assert.equal(
      JSON.parse(readFileSync(join(result.candidate, "package.json"), "utf8"))
        .name,
      "personal",
    );
    const text = readFileSync(join(result.candidate, "app.txt"), "utf8");
    assert.match(text, /Owner customization/);
    assert.match(text, /Upstream improvement/);
    assert.equal(existsSync(join(result.candidate, "remove.txt")), false);
    assert.equal(existsSync(join(result.candidate, "rename.txt")), false);
    assert.equal(existsSync(join(result.candidate, "renamed.txt")), true);
    assert.deepEqual(
      readFileSync(join(result.candidate, "image.bin")),
      Buffer.from([0, 255, 1, 2, 0, 254]),
    );
    assert.match(
      git(result.candidate, ["ls-tree", "HEAD", "executable"]),
      /^100755/,
    );
    assert.equal(result.validation, "pending");
    assert.equal(result.deployed, false);
    assert.equal(matchBaseline(result.candidate, original, target), f.baseline);
    assert.ok(existsSync(join(result.output, "candidate.bundle")));
    rmSync(result.output, { recursive: true, force: true });
  } finally {
    f.cleanup();
  }
});

test("bootstrap automatic matching, no-change, ordinary fork and canonical self-update", () => {
  const f = fixture();
  try {
    write(f.upstream, "new.txt", "update\n");
    const target = commit(f.upstream, "Update");
    const result = prepare(f);
    assert.equal(result.baseline, f.baseline);
    const current = prepareUpdate({
      downstream: result.candidate,
      upstreamPath: f.upstream,
      source: "example/upstream",
      downstreamId: "owner/copy",
    });
    assert.equal(current.status, "current");
    const fork = join(f.root, "fork");
    git(f.root, ["clone", f.upstream, fork]);
    git(fork, ["reset", "--hard", f.baseline]);
    const forkResult = prepareUpdate({
      downstream: fork,
      upstreamPath: f.upstream,
      source: "example/upstream",
      downstreamId: "owner/fork",
      baseline: f.baseline,
    });
    assert.equal(forkResult.target, target);
    assert.equal(
      prepareUpdate({
        downstream: f.downstream,
        source: "example/upstream",
        downstreamId: "example/upstream",
      }).status,
      "current",
    );
    rmSync(result.output, { recursive: true, force: true });
    rmSync(forkResult.output, { recursive: true, force: true });
  } finally {
    f.cleanup();
  }
});

test("conflicts, ambiguous baselines, dirty checkouts, missing history and destructive config changes stop without mutation", () => {
  const f = fixture();
  try {
    git(f.upstream, ["commit", "--allow-empty", "-m", "Duplicate tree"]);
    assert.throws(
      () => prepare(f),
      (error: any) => error.code === "baseline_required",
    );
    write(f.downstream, "dirty.txt", "Unsaved\n");
    assert.throws(
      () => prepare(f, { baseline: f.baseline }),
      (error: any) => error.code === "dirty_checkout",
    );
    rmSync(join(f.downstream, "dirty.txt"));
    write(f.downstream, "app.txt", "Owner replaces the file\n");
    const before = commit(f.downstream, "Owner replacement");
    write(f.upstream, "app.txt", "Upstream replaces the file\n");
    commit(f.upstream, "Conflicting replacement");
    assert.throws(
      () => prepare(f, { baseline: f.baseline }),
      (error: any) =>
        error.code === "conflict" && error.details.paths.includes("app.txt"),
    );
    assert.equal(git(f.downstream, ["rev-parse", "HEAD"]).trim(), before);
    assert.throws(
      () => prepare(f, { baseline: "f".repeat(40) }),
      (error: any) => error.code === "baseline_unavailable",
    );
    assert.throws(() =>
      prepare(f, { baseline: f.baseline, target: f.baseline.slice(0, 12) }),
    );
    git(f.downstream, ["reset", "--hard", "HEAD~1"]);
    git(f.upstream, ["reset", "--hard", f.baseline]);
    write(
      f.upstream,
      "wrangler.jsonc",
      JSON.stringify({ ...f.config, migrations: [] }, null, 2) + "\n",
    );
    commit(f.upstream, "Destructive migration edit");
    assert.throws(
      () => prepare(f, { baseline: f.baseline }),
      (error: any) => error.code === "migration_change",
    );
    git(f.upstream, ["checkout", "--orphan", "replaced"]);
    git(f.upstream, ["add", "-A"]);
    const unrelated = commit(f.upstream, "Replaced history");
    assert.throws(
      () => prepare(f, { baseline: f.baseline, target: unrelated }),
      (error: any) => error.code === "history_replaced",
    );
  } finally {
    f.cleanup();
  }
});

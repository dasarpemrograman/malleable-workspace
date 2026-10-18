import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
// @ts-expect-error Native JavaScript operator tooling.
import * as importer from "../scripts/lib/git-update.mjs";
// @ts-expect-error Native JavaScript operator tooling.
import * as publisher from "../scripts/lib/publish-update.mjs";
const { git, prepareUpdate } = importer;
const { publishUpdate, describeUpdate } = publisher;
function commit(path: string) {
  git(path, ["add", "-A"]);
  git(path, ["commit", "-m", "fixture"]);
  return git(path, ["rev-parse", "HEAD"]).trim();
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), "publication-test-"));
  const source = join(root, "source"),
    copy = join(root, "copy"),
    remote = join(root, "remote.git");
  for (const repo of [source, copy]) {
    mkdirSync(repo);
    git(repo, ["init", "-b", "main"]);
    git(repo, ["config", "user.name", "fixture"]);
    git(repo, ["config", "user.email", "fixture@example.invalid"]);
    mkdirSync(join(repo, "src"));
    writeFileSync(
      join(repo, "src/index.ts"),
      'env.WORKSPACE.getByName("primary")',
    );
    writeFileSync(
      join(repo, "package.json"),
      JSON.stringify({ name: repo === source ? "upstream" : "personal" }),
    );
    writeFileSync(
      join(repo, "wrangler.jsonc"),
      JSON.stringify({
        name: repo === source ? "upstream" : "personal",
        main: "src/index.ts",
        durable_objects: {
          bindings: [{ name: "WORKSPACE", class_name: "Workspace" }],
        },
        migrations: [{ tag: "v1", new_sqlite_classes: ["Workspace"] }],
      }),
    );
    commit(repo);
  }
  writeFileSync(join(source, "improvement.txt"), "improved");
  const target = commit(source);
  const prepared = prepareUpdate({
    downstream: copy,
    downstreamId: "owner/copy",
    source: "example/upstream",
    upstreamPath: source,
  });
  git(root, ["clone", "--bare", copy, remote]);
  return {
    root,
    source,
    copy,
    remote,
    target,
    prepared,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(prepared.output, { recursive: true, force: true });
    },
  };
}

test("publication handles Git objects only, retries after denied PR creation, drafts failed candidates and deduplicates", () => {
  const f = setup();
  try {
    const opts = {
      directory: f.prepared.output,
      repo: "owner/copy",
      remoteUrl: f.remote,
      validation: "failed",
    };
    let created = 0;
    const api = {
      findOpen: () => [],
      create: ({ draft, bodyFile }: any) => {
        assert.equal(draft, true);
        const body = readFileSync(bodyFile, "utf8");
        assert.match(body, /validation: failed/);
        assert.match(body, /not started/);
        assert.match(body, /Approve workflows to run/);
        assert.match(body, new RegExp(f.target));
        if (!created++) throw Error("PR permission denied");
        return "https://github.com/owner/copy/pull/1";
      },
    };
    assert.throws(() => publishUpdate({ ...opts, api }));
    const ownerBase = git(f.remote, ["rev-parse", "main"]).trim();
    const result = publishUpdate({ ...opts, api });
    assert.equal(result.deployed, false);
    assert.equal(result.validation, "failed");
    assert.equal(created, 2);
    assert.equal(git(f.remote, ["rev-parse", "main"]).trim(), ownerBase);
    git(f.copy, ["fetch", f.remote, f.prepared.branch]);
    git(f.copy, ["switch", "-c", "owner-review", "FETCH_HEAD"]);
    writeFileSync(join(f.copy, "owner-review.txt"), "Owner reviewed edit");
    const ownerReview = commit(f.copy);
    git(f.copy, ["push", f.remote, `HEAD:refs/heads/${f.prepared.branch}`]);
    const reused = publishUpdate({
      ...opts,
      api: {
        findOpen: () => [{ url: result.pullRequest }],
        create: () => {
          throw Error("duplicate");
        },
      },
    });
    assert.equal(reused.reused, true);
    assert.equal(
      git(f.remote, ["rev-parse", f.prepared.branch]).trim(),
      ownerReview,
    );
    assert.throws(
      () => publishUpdate({ ...opts, api }),
      (e: any) => e.code === "branch_exists",
    );
    // A published PR must not be reset when its owner adds a commit.
    const body = describeUpdate(f.prepared, "pending");
    assert.match(body, /not ready/);
    assert.doesNotMatch(body, /validation passed/);
  } finally {
    f.cleanup();
  }
});

test("moved source refs stay pinned; stale default branches and tampered summaries cannot publish", () => {
  const f = setup();
  try {
    writeFileSync(join(f.source, "later.txt"), "later");
    const moved = commit(f.source);
    assert.notEqual(moved, f.prepared.target);
    assert.equal(f.prepared.target, f.target);
    const pinned = prepareUpdate({
      downstream: f.copy,
      downstreamId: "owner/copy",
      source: "example/upstream",
      upstreamPath: f.source,
      target: f.target,
    });
    assert.equal(pinned.target, f.target);
    assert.equal(
      readFileSync(join(pinned.candidate, "improvement.txt"), "utf8"),
      "improved",
    );
    rmSync(pinned.output, { recursive: true, force: true });
    const summaryFile = join(f.prepared.output, "summary.json");
    const original = readFileSync(summaryFile, "utf8");
    writeFileSync(
      summaryFile,
      JSON.stringify({ ...JSON.parse(original), files: ["forged"] }),
    );
    const api = {
      findOpen: () => [],
      create: () => {
        throw Error("must not publish");
      },
    };
    const opts = {
      directory: f.prepared.output,
      repo: "owner/copy",
      remoteUrl: f.remote,
      api,
    };
    assert.throws(
      () => publishUpdate(opts),
      (e: any) => e.code === "artifact_mismatch",
    );
    writeFileSync(summaryFile, original);
    writeFileSync(join(f.copy, "owner.txt"), "new owner edit");
    commit(f.copy);
    git(f.copy, ["push", f.remote, "main"]);
    assert.throws(
      () => publishUpdate(opts),
      (e: any) => e.code === "stale_base",
    );
    assert.equal(
      git(f.remote, ["branch", "--list", "upstream-update/*"]).trim(),
      "",
    );
  } finally {
    f.cleanup();
  }
});

test("manual workflow isolates candidate execution from write credentials and publishes immutable preparer artifacts", () => {
  const text = readFileSync(".github/workflows/upstream-update.yml", "utf8");
  const workflow = parse(text);
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.permissions, {});
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  const { prepare, validate, publish } = workflow.jobs;
  assert.deepEqual(validate.permissions, {});
  for (const job of [prepare, validate, publish]) {
    assert.doesNotMatch(JSON.stringify(job.env ?? {}), /runner\./);
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[a-f0-9]{40}$/);
      if (step.uses?.startsWith("actions/checkout")) {
        assert.equal(step.with["persist-credentials"], false);
        assert.equal(step.with.ref, "${{ github.workflow_sha }}");
      }
    }
  }
  assert.equal(prepare.permissions.contents, "read");
  assert.equal(publish.permissions.contents, "write");
  const candidate = JSON.stringify(validate);
  assert.doesNotMatch(candidate, /secrets\.|github.token|contents.*write/);
  assert.match(candidate, /npm ci/);
  assert.match(candidate, /npm run typecheck/);
  assert.match(candidate, /npm test/);
  assert.match(candidate, /test:browser/);
  assert.doesNotMatch(
    JSON.stringify(publish.steps),
    /candidate.*checkout|npm test|npm run deploy/,
  );
  for (const job of [validate, publish]) {
    const artifact = job.steps.find((s: any) =>
      s.uses?.startsWith("actions/download-artifact"),
    );
    assert.equal(
      artifact.with["artifact-ids"],
      "${{ needs.prepare.outputs.artifact }}",
    );
    // ID-based downloads otherwise add an artifact-name directory, hiding the bundle.
    assert.equal(artifact.with["merge-multiple"], true);
  }
  assert.match(JSON.stringify(publish), /needs.validate.result == 'success'/);
  assert.doesNotMatch(text, /schedule:|pull_request_target|wrangler deploy/);
});

test("trusted preparation refuses a non-default workflow revision without echoing credentials", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-input-test-"));
  try {
    const event = join(root, "event.json");
    writeFileSync(
      event,
      JSON.stringify({ repository: { default_branch: "main" } }),
    );
    const result = spawnSync(
      process.execPath,
      ["scripts/prepare-update-action.mjs"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: event,
          GITHUB_REF: "refs/heads/untrusted",
          GH_TOKEN: "fixture-never-echo-write-credential",
          CLOUDFLARE_API_TOKEN: "fixture-never-echo-cloudflare",
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /workflow_branch/);
    assert.doesNotMatch(result.stderr + result.stdout, /fixture-never-echo/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

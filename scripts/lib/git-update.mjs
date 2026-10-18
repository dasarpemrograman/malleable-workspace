import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { modify, applyEdits } from "jsonc-parser";
import {
  CANONICAL,
  OWNER_FILES,
  UpdateError,
  requireUpdate,
  sha,
  repository,
  trackingRef,
  upstreamSchema,
  deploymentSchema,
  readMetadata,
  parseConfig,
  safePath,
  validateConfigTransition,
} from "./update-model.mjs";

export function git(cwd, args, options = {}) {
  return execFileSync(
    "git",
    [
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "credential.helper=!gh auth git-credential",
      ...args,
    ],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...options.env },
    },
  );
}
function entries(repo, tree) {
  return Object.fromEntries(
    git(repo, ["ls-tree", "-r", "-z", tree])
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("\t");
        const header = line.slice(0, separator),
          path = line.slice(separator + 1);
        const [mode, type, object] = header.split(" ");
        return [path, { mode, type, object }];
      }),
  );
}
function textAt(repo, commit, path) {
  return git(repo, ["show", `${commit}:${path}`]);
}
function ownedNames(repo, commit) {
  const names = {};
  for (const file of ["package.json", "wrangler.jsonc"]) {
    const record = entries(repo, commit)[file];
    requireUpdate(
      record && ["100644", "100755"].includes(record.mode),
      "invalid_project",
      `${file} must be a regular file.`,
    );
    const name = parseConfig(textAt(repo, commit, file)).name;
    requireUpdate(
      typeof name === "string" && name.length > 0,
      "invalid_project",
      `${file} requires an instance name.`,
    );
    names[file] = name;
  }
  return names;
}
function normalizedTree(repo, commit, names, index) {
  const env = { ...process.env, GIT_INDEX_FILE: index };
  git(repo, ["read-tree", commit], { env });
  const files = entries(repo, commit);
  for (const [file, name] of Object.entries(names)) {
    requireUpdate(
      files[file] && ["100644", "100755"].includes(files[file].mode),
      "invalid_project",
      `Upstream must retain regular ${file}.`,
    );
    const original = textAt(repo, commit, file);
    const normalized = applyEdits(
      original,
      modify(original, ["name"], name, {}),
    );
    const blob = git(repo, ["hash-object", "-w", "--stdin"], {
      input: normalized,
    }).trim();
    git(repo, ["update-index", "--cacheinfo", files[file].mode, blob, file], {
      env,
    });
  }
  for (const path of OWNER_FILES)
    git(repo, ["update-index", "--force-remove", "--", path], { env });
  return git(repo, ["write-tree"], { env }).trim();
}
function signature(repo, commit) {
  const records = entries(repo, commit);
  for (const file of OWNER_FILES) delete records[file];
  for (const file of ["package.json", "wrangler.jsonc"]) {
    if (!records[file] || !["100644", "100755"].includes(records[file].mode))
      return null;
    const value = parseConfig(textAt(repo, commit, file));
    delete value.name;
    records[file] = { ...records[file], object: JSON.stringify(value) };
  }
  return JSON.stringify(
    Object.entries(records).sort(([a], [b]) => a.localeCompare(b)),
  );
}
export function matchBaseline(repo, downstream, target) {
  const wanted = signature(repo, downstream);
  const matches = [];
  for (const commit of git(repo, ["rev-list", target]).trim().split("\n")) {
    try {
      if (signature(repo, commit) === wanted) matches.push(commit);
    } catch (error) {
      if (error instanceof UpdateError) continue;
      throw error;
    }
  }
  requireUpdate(
    matches.length === 1,
    "baseline_required",
    "Supply --baseline with a reviewed full upstream SHA; a unique content match was not found.",
    { matches },
  );
  return matches[0];
}
function inspectRouting(repo, commit, config) {
  const file = (config.main ?? "").replace(/^\.\//, "");
  requireUpdate(
    file && !file.startsWith("/") && !file.split("/").includes(".."),
    "routing_change",
    "The Worker entry point must stay inside the repository.",
  );
  const source = textAt(repo, commit, file);
  const calls = source.match(/\.getByName\s*\([^)]*\)/g) ?? [];
  requireUpdate(
    calls.length === 1 &&
      /^\.getByName\s*\(\s*["']primary["']\s*\)$/.test(calls[0]),
    "routing_change",
    "Expected exactly one literal primary object route; changed routing needs review.",
  );
}

/** Prepare in a new clone; never mutate the owner's checkout or default branch. */
export function prepareUpdate({
  downstream,
  downstreamId,
  upstreamPath,
  source = CANONICAL,
  ref,
  baseline,
  target,
  output,
  deployment,
}) {
  repository.parse(source);
  if (downstreamId && downstreamId.toLowerCase() === source.toLowerCase())
    return {
      status: "current",
      reason: "This is the configured upstream repository.",
    };
  if (downstreamId) repository.parse(downstreamId);
  if (baseline) sha.parse(baseline);
  if (target) sha.parse(target);
  if (ref) trackingRef.parse(ref);
  if (existsSync(downstream)) {
    const dirty = git(resolve(downstream), [
      "status",
      "--porcelain",
      "--untracked-files=normal",
    ]);
    requireUpdate(
      !dirty,
      "dirty_checkout",
      "Commit or stash local edits before preparing an update; no owner files were changed.",
    );
  }
  const work = output
    ? resolve(output)
    : mkdtempSync(join(tmpdir(), "workspace-update-"));
  if (output) {
    requireUpdate(
      !existsSync(work),
      "output_exists",
      "Choose a new output directory.",
    );
    mkdirSync(work, { recursive: true });
  }
  const candidate = join(work, "candidate");
  try {
    git(work, [
      "clone",
      "--no-hardlinks",
      "--no-checkout",
      "--",
      downstream,
      candidate,
    ]);
    git(candidate, ["checkout", "--detach", "HEAD"]);
    const downstreamCommit = git(candidate, ["rev-parse", "HEAD"]).trim();
    const metadata = readMetadata(candidate, OWNER_FILES[0], upstreamSchema);
    const enrolled = readMetadata(candidate, OWNER_FILES[1], deploymentSchema);
    requireUpdate(
      !metadata || metadata.repository === source,
      "source_mismatch",
      "The selected source differs from the enrolled upstream; review a rebaseline first.",
    );
    const track = trackingRef.parse(ref ?? metadata?.ref ?? "main");
    git(candidate, [
      "remote",
      "add",
      "workspace-upstream",
      upstreamPath ?? `https://github.com/${source}.git`,
    ]);
    try {
      git(candidate, ["fetch", "--no-tags", "workspace-upstream", track]);
    } catch {
      throw new UpdateError(
        "source_unavailable",
        "Could not fetch the configured public upstream/ref.",
      );
    }
    const resolved = git(candidate, [
      "rev-parse",
      "FETCH_HEAD^{commit}",
    ]).trim();
    const targetCommit = target ?? resolved;
    if (target && target !== resolved) {
      try {
        git(candidate, ["fetch", "--no-tags", "workspace-upstream", target]);
      } catch {
        throw new UpdateError(
          "target_unavailable",
          "The pinned target could not be fetched.",
        );
      }
    }
    const imported =
      baseline ??
      metadata?.importedCommit ??
      matchBaseline(candidate, downstreamCommit, targetCommit);
    sha.parse(imported);
    try {
      git(candidate, ["cat-file", "-e", `${imported}^{commit}`]);
    } catch {
      try {
        git(candidate, ["fetch", "--no-tags", "workspace-upstream", imported]);
      } catch {
        throw new UpdateError(
          "baseline_unavailable",
          "The recorded upstream baseline is unavailable; explicitly review a rebaseline.",
        );
      }
    }
    requireUpdate(
      spawnSync(
        "git",
        ["merge-base", "--is-ancestor", imported, targetCommit],
        { cwd: candidate },
      ).status === 0,
      "history_replaced",
      "The target is not descended from the imported baseline; explicit rebaseline required.",
    );
    if (imported === targetCommit && metadata) {
      rmSync(work, { recursive: true, force: true });
      return { status: "current", baseline: imported, target: targetCommit };
    }
    const previous = parseConfig(
      readFileSync(safePath(candidate, "wrangler.jsonc"), "utf8"),
    );
    const names = ownedNames(candidate, downstreamCommit);
    const from = normalizedTree(
      candidate,
      imported,
      names,
      join(work, "base-index"),
    );
    const to = normalizedTree(
      candidate,
      targetCommit,
      names,
      join(work, "target-index"),
    );
    const patch = git(candidate, [
      "diff",
      "--binary",
      "--full-index",
      "--find-renames",
      from,
      to,
    ]);
    requireUpdate(
      Buffer.byteLength(patch) <= 32 * 1024 * 1024,
      "patch_too_large",
      "Update patch exceeds 32 MiB; review it manually.",
    );
    if (patch) {
      const applied = spawnSync(
        "git",
        ["-c", "core.hooksPath=/dev/null", "apply", "--3way", "--index", "-"],
        { cwd: candidate, input: patch, encoding: "utf8" },
      );
      if (applied.status !== 0) {
        const conflicts = git(candidate, [
          "diff",
          "--name-only",
          "--diff-filter=U",
        ])
          .trim()
          .split("\n")
          .filter(Boolean);
        const paths = conflicts.length
          ? conflicts
          : git(candidate, ["diff", "--name-only", from, to])
              .trim()
              .split("\n")
              .filter(Boolean);
        throw new UpdateError(
          "conflict",
          "Upstream changes conflict with this copy. Resolve these paths in a reviewed update; no branch was changed.",
          { paths },
        );
      }
    }
    const next = parseConfig(
      readFileSync(safePath(candidate, "wrangler.jsonc"), "utf8"),
    );
    validateConfigTransition(previous, next);
    inspectRouting(candidate, "", next);
    const destination = deployment
      ? deploymentSchema.parse(deployment)
      : enrolled;
    if (enrolled && deployment)
      requireUpdate(
        JSON.stringify(enrolled) === JSON.stringify(destination),
        "identity_change",
        "Existing deployment enrollment cannot be replaced by an update.",
      );
    if (destination) {
      requireUpdate(
        destination.workerName === next.name,
        "destination_mismatch",
        "Enrollment must match the downstream Worker name.",
      );
      validateConfigTransition(
        { ...previous, migrations: destination.migrations },
        next,
      );
    }
    for (const file of OWNER_FILES) safePath(candidate, file);
    mkdirSync(join(candidate, ".workspace"), { recursive: true });
    writeFileSync(
      safePath(candidate, OWNER_FILES[0]),
      JSON.stringify(
        {
          version: 1,
          repository: source,
          ref: track,
          importedCommit: targetCommit,
        },
        null,
        2,
      ) + "\n",
    );
    if (destination)
      writeFileSync(
        safePath(candidate, OWNER_FILES[1]),
        JSON.stringify(destination, null, 2) + "\n",
      );
    git(candidate, [
      "add",
      "--",
      ...OWNER_FILES.filter((file) => existsSync(join(candidate, file))),
    ]);
    const branch = `upstream-update/${targetCommit}`;
    git(candidate, ["switch", "-c", branch]);
    git(candidate, [
      "-c",
      "user.name=github-actions[bot]",
      "-c",
      "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit",
      "-m",
      `Import upstream ${targetCommit.slice(0, 12)}`,
    ]);
    const commit = git(candidate, ["rev-parse", "HEAD"]).trim();
    const files = git(candidate, [
      "diff",
      "--name-only",
      downstreamCommit,
      commit,
    ])
      .trim()
      .split("\n")
      .filter(Boolean);
    const summary = {
      version: 1,
      status: "prepared",
      repository: downstreamId ?? null,
      source,
      ref: track,
      baseline: imported,
      target: targetCommit,
      downstreamCommit,
      candidateCommit: commit,
      branch,
      files,
      review: {
        dependencies: files.filter((p) => /^package(-lock)?\.json$/.test(p)),
        workflows: files.filter((p) => p.startsWith(".github/")),
        configuration: files.filter(
          (p) => p === "wrangler.jsonc" || p.startsWith(".workspace/"),
        ),
        migrations: next.migrations.slice(previous.migrations.length),
      },
      validation: "pending",
      deployed: false,
    };
    writeFileSync(
      join(work, "summary.json"),
      JSON.stringify(summary, null, 2) + "\n",
    );
    git(candidate, [
      "bundle",
      "create",
      join(work, "candidate.bundle"),
      branch,
    ]);
    // A tarball is never extracted into the trusted publication job.
    git(candidate, [
      "archive",
      "--format=tar",
      "-o",
      join(work, "candidate.tar"),
      commit,
    ]);
    return { ...summary, output: work, candidate };
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    if (error instanceof UpdateError) throw error;
    throw new UpdateError(
      "preparation_failed",
      "Update preparation failed before publication; check source access and repository format.",
    );
  }
}

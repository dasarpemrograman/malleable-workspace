import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { git } from "./git-update.mjs";
import {
  UpdateError,
  requireUpdate,
  repository,
  sha,
  trackingRef,
  upstreamSchema,
} from "./update-model.mjs";

export const summarySchema = z
  .object({
    version: z.literal(1),
    status: z.literal("prepared"),
    repository: repository.nullable(),
    source: repository,
    ref: trackingRef,
    baseline: sha,
    target: sha,
    downstreamCommit: sha,
    candidateCommit: sha,
    branch: z.string(),
    files: z.array(z.string()),
    review: z
      .object({
        dependencies: z.array(z.string()),
        workflows: z.array(z.string()),
        configuration: z.array(z.string()),
        migrations: z.array(z.unknown()),
      })
      .strict(),
    validation: z.literal("pending"),
    deployed: z.literal(false),
  })
  .strict();
function gh(args) {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new UpdateError(
      "github_access",
      "GitHub access failed. Authenticate gh, enable Actions PR creation if applicable, and grant this repository contents/PR write access. No default branch or deployment was changed.",
    );
  }
}
const github = {
  findOpen: ({ repo, branch, base }) =>
    JSON.parse(
      gh([
        "pr",
        "list",
        "--repo",
        repo,
        "--head",
        branch,
        "--base",
        base,
        "--state",
        "open",
        "--json",
        "url",
      ]),
    ),
  create: ({ repo, branch, base, title, bodyFile, draft }) =>
    gh([
      "pr",
      "create",
      "--repo",
      repo,
      "--head",
      branch,
      "--base",
      base,
      "--title",
      title,
      "--body-file",
      bodyFile,
      ...(draft ? ["--draft"] : []),
    ]).trim(),
};
function prUrl(value, repo) {
  requireUpdate(
    typeof value === "string" &&
      new RegExp(
        `^https://github\\.com/${repo.replaceAll(".", "\\.")}/pull/[0-9]+$`,
        "i",
      ).test(value),
    "github_response",
    "GitHub did not return a PR URL for the selected repository.",
  );
  return value;
}
export function describeUpdate(summary, validation, runUrl) {
  const intro =
    validation === "passed"
      ? "Updater validation passed. Review before merging."
      : `Updater validation: ${validation}. This draft is not ready for promotion.`;
  return `${intro}\n\nSource: https://github.com/${summary.source}\n\nImported baseline: \`${summary.baseline}\`\nTarget: \`${summary.target}\`\nDownstream base: \`${summary.downstreamCommit}\`\n\n${runUrl ? `Updater run: ${runUrl}\n\n` : ""}Production deployment: **not started**. A merge may queue the downstream repository's configured Cloudflare Workers Build; inspect its source commit, result and active Worker version before calling the update deployed.\n\nNormal PR checks are separate. If GitHub requires **Approve workflows to run**, approve them and inspect their results; updater success does not mean pending PR checks passed. Configure Workers Builds if no production build is connected.\n\nReview dependencies, workflows, bindings and migrations:\n\n\`\`\`json\n${JSON.stringify({ files: summary.files, ...summary.review }, null, 2)}\n\`\`\`\n\nPreserve deployment enrollment, receiver settings and migration history. Export a snapshot before a data migration. Reverting code does not rewind migrated data.\n`;
}

/** Publication handles Git objects only: it never checks out or runs candidate code. */
export function publishUpdate({
  directory,
  repo,
  base = "main",
  validation = "pending",
  runUrl,
  api = github,
  remoteUrl,
}) {
  repository.parse(repo);
  trackingRef.parse(base);
  z.enum(["passed", "failed", "pending"]).parse(validation);
  if (runUrl) {
    const u = new URL(runUrl);
    requireUpdate(
      u.origin === "https://github.com" &&
        u.pathname.startsWith(`/${repo}/actions/runs/`) &&
        !u.search &&
        !u.hash,
      "invalid_run_url",
      "Use a run URL from this repository.",
    );
  }
  const summary = summarySchema.parse(
    JSON.parse(readFileSync(join(directory, "summary.json"), "utf8")),
  );
  requireUpdate(
    summary.repository === repo &&
      summary.branch === `upstream-update/${summary.target}`,
    "artifact_mismatch",
    "Candidate metadata must match the trusted repository and pinned target.",
  );
  const existing = api.findOpen({ repo, branch: summary.branch, base });
  requireUpdate(
    Array.isArray(existing) && existing.length <= 1,
    "github_response",
    "Expected at most one open PR for this target.",
  );
  if (existing.length)
    return {
      status: "prepared",
      pullRequest: prUrl(existing[0].url, repo),
      reused: true,
      validation: "Inspect the existing PR/run",
      deployed: false,
    };
  const work = mkdtempSync(join(tmpdir(), "workspace-publish-"));
  try {
    git(work, ["init", "--bare"]);
    git(work, [
      "remote",
      "add",
      "origin",
      remoteUrl ?? `https://github.com/${repo}.git`,
    ]);
    try {
      git(work, [
        "fetch",
        "--no-tags",
        "origin",
        `${base}:refs/heads/owner-base`,
      ]);
    } catch {
      throw new UpdateError(
        "github_access",
        "Cannot fetch the downstream production branch; check GitHub repository access.",
      );
    }
    requireUpdate(
      git(work, ["rev-parse", "refs/heads/owner-base"]).trim() ===
        summary.downstreamCommit,
      "stale_base",
      "The production branch advanced during preparation. Prepare a fresh candidate; nothing was pushed.",
    );
    git(work, [
      "fetch",
      join(directory, "candidate.bundle"),
      `${summary.branch}:refs/heads/candidate`,
    ]);
    requireUpdate(
      git(work, ["rev-parse", "refs/heads/candidate"]).trim() ===
        summary.candidateCommit,
      "artifact_mismatch",
      "Bundle commit differs from preparation metadata.",
    );
    requireUpdate(
      git(work, [
        "show",
        "-s",
        "--format=%P",
        summary.candidateCommit,
      ]).trim() === summary.downstreamCommit,
      "artifact_mismatch",
      "The candidate must be one commit based on the reviewed downstream revision.",
    );
    const provenance = upstreamSchema.parse(
      JSON.parse(
        git(work, [
          "show",
          `${summary.candidateCommit}:.workspace/upstream.json`,
        ]),
      ),
    );
    requireUpdate(
      provenance.importedCommit === summary.target &&
        provenance.repository === summary.source &&
        provenance.ref === summary.ref,
      "artifact_mismatch",
      "Candidate provenance differs from the pinned source/target.",
    );
    const changes = git(work, [
      "diff",
      "--name-only",
      summary.downstreamCommit,
      summary.candidateCommit,
    ])
      .trim()
      .split("\n")
      .filter(Boolean);
    requireUpdate(
      JSON.stringify(changes) === JSON.stringify(summary.files),
      "artifact_mismatch",
      "Candidate changed-file list differs from its review summary.",
    );
    const remote = git(work, [
      "ls-remote",
      "--heads",
      "origin",
      `refs/heads/${summary.branch}`,
    ]).trim();
    if (remote) {
      git(work, [
        "fetch",
        "origin",
        `${summary.branch}:refs/heads/existing-candidate`,
      ]);
      requireUpdate(
        git(work, ["rev-parse", "existing-candidate^{tree}"]) ===
          git(work, ["rev-parse", "candidate^{tree}"]) &&
          git(work, [
            "show",
            "-s",
            "--format=%P",
            "existing-candidate",
          ]).trim() === summary.downstreamCommit,
        "branch_exists",
        "This update branch has other commits. Review it manually; it was not overwritten.",
      );
    } else {
      try {
        git(work, [
          "push",
          "origin",
          `${summary.candidateCommit}:refs/heads/${summary.branch}`,
        ]);
      } catch {
        throw new UpdateError(
          "github_access",
          "Could not publish the update branch. Check repository contents write permission; no force push was attempted.",
        );
      }
    }
    const bodyFile = join(work, "pr-body.md");
    writeFileSync(bodyFile, describeUpdate(summary, validation, runUrl));
    const url = api.create({
      repo,
      branch: summary.branch,
      base,
      title: `Upstream update ${summary.target.slice(0, 12)}`,
      bodyFile,
      draft: validation !== "passed",
    });
    return {
      status: "prepared",
      pullRequest: prUrl(url, repo),
      reused: false,
      validation,
      deployed: false,
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

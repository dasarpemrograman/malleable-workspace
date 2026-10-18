import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { prepareFromArgs } from "./upstream-update.mjs";
import {
  deploymentSchema,
  parseConfig,
  requireUpdate,
  UpdateError,
} from "./lib/update-model.mjs";

try {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const branch = event.repository.default_branch;
  requireUpdate(
    process.env.GITHUB_REF === `refs/heads/${branch}`,
    "workflow_branch",
    "Run the updater workflow from the trusted default branch.",
  );
  const args = [
    "--repo",
    process.env.GITHUB_REPOSITORY,
    "--downstream",
    process.cwd(),
    "--output",
    join(process.env.RUNNER_TEMP, "upstream-candidate"),
  ];
  if (process.env.UPDATE_REF) args.push("--ref", process.env.UPDATE_REF);
  if (process.env.UPDATE_BASELINE)
    args.push("--baseline", process.env.UPDATE_BASELINE);
  if (process.env.UPDATE_ACCOUNT || process.env.UPDATE_NAMESPACE) {
    const cfg = parseConfig(readFileSync("wrangler.jsonc", "utf8"));
    const enrollment = deploymentSchema.parse({
      version: 1,
      accountId: process.env.UPDATE_ACCOUNT,
      namespaceId: process.env.UPDATE_NAMESPACE,
      workerName: cfg.name,
      bindingName: "WORKSPACE",
      className: "Workspace",
      objectName: "primary",
      productionBranch: branch,
      migrations: cfg.migrations,
    });
    const file = join(process.env.RUNNER_TEMP, "deployment-enrollment.json");
    writeFileSync(file, JSON.stringify(enrollment), { mode: 0o600 });
    args.push("--deployment", file);
  }
  const result = prepareFromArgs(args);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `prepared=${result.status === "prepared"}\nbranch=${result.branch ?? ""}\n`,
  );
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    result.status === "prepared"
      ? `Prepared upstream candidate \`${result.target}\` from \`${result.baseline}\`. Candidate checks have not run yet; no deployment started.\n`
      : `No update candidate: ${result.reason ?? "Already current"}. No PR or deployment started.\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error instanceof UpdateError ? error.code : "invalid_input",
      message:
        error instanceof UpdateError
          ? error.message
          : "Check updater inputs, metadata and repository permissions.",
    }),
  );
  process.exitCode = 1;
}

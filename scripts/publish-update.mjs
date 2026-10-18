import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  publishUpdate,
  describeUpdate,
  summarySchema,
} from "./lib/publish-update.mjs";
import { UpdateError } from "./lib/update-model.mjs";

try {
  const { values } = parseArgs({
    strict: true,
    options: {
      directory: { type: "string" },
      repo: { type: "string" },
      base: { type: "string", default: "main" },
      validation: { type: "string", default: "pending" },
      "run-url": { type: "string" },
    },
  });
  if (!values.directory || !values.repo)
    throw new Error("Provide --directory and --repo.");
  const result = publishUpdate({
    directory: resolve(values.directory),
    repo: values.repo,
    base: values.base,
    validation: values.validation,
    runUrl: values["run-url"],
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = summarySchema.parse(
      JSON.parse(
        readFileSync(join(resolve(values.directory), "summary.json"), "utf8"),
      ),
    );
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${result.pullRequest}\n\n${result.reused ? "Reused an existing PR; inspect its current checks and review changes. No branch was rewritten.\n" : describeUpdate(summary, result.validation, values["run-url"])}`,
    );
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "blocked",
        code: error instanceof UpdateError ? error.code : "invalid_input",
        message:
          error instanceof UpdateError
            ? error.message
            : "Check the trusted repository, candidate directory, and validation result.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

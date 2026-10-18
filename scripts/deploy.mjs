import { deployWorkspace } from "./lib/deployment.mjs";
import { UpdateError, requireUpdate } from "./lib/update-model.mjs";
try {
  requireUpdate(
    process.argv.slice(2).every((a) => a === "--dry-run"),
    "unsupported_option",
    "Supported deploy option: --dry-run. Change the reviewed configuration instead of overriding the destination.",
  );
  console.log(
    JSON.stringify(
      deployWorkspace({ dryRun: process.argv.includes("--dry-run") }),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: error instanceof UpdateError ? error.code : "validation_failed",
      message:
        error instanceof UpdateError
          ? error.message
          : "Validation or upload failed. Inspect the build log and active Cloudflare version; source import alone does not prove deployment.",
      ...(error instanceof UpdateError ? { details: error.details } : {}),
    }),
  );
  process.exitCode = 1;
}

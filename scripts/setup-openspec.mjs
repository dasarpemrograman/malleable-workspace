import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Keep the complete project workflow set reproducible without changing the
// contributor's global OpenSpec preferences.
const workflows = [
  "propose",
  "explore",
  "new",
  "continue",
  "apply",
  "update",
  "ff",
  "sync",
  "archive",
  "bulk-archive",
  "verify",
  "onboard",
];
const configHome = mkdtempSync(join(tmpdir(), "malleable-openspec-"));
const cli = new URL(
  "../node_modules/@fission-ai/openspec/bin/openspec.js",
  import.meta.url,
);
try {
  for (const args of [
    ["config", "set", "profile", "custom"],
    ["config", "set", "workflows", JSON.stringify(workflows)],
    ["config", "set", "delivery", "both"],
    ["init", "--tools", "codex", "--profile", "custom", "--no-animation"],
  ]) {
    const result = spawnSync(process.execPath, [cli.pathname, ...args], {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
        OPENSPEC_TELEMETRY: "0",
      },
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`OpenSpec ${args[0]} failed (${result.status}).`);
  }
} finally {
  rmSync(configHome, { recursive: true, force: true });
}

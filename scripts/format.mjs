import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const mode = process.argv[2];
if (!["--check", "--write"].includes(mode)) {
  console.error("Use --check or --write.");
  process.exit(1);
}
const paths = [
  "src",
  "scripts",
  "examples",
  "tests",
  ".github",
  "README.md",
  "CONTRIBUTING.md",
  "docs/architecture.md",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "playwright.config.ts",
  "wrangler.jsonc",
  ".prettierrc.json",
  "openspec/config.yaml",
].filter(existsSync);
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prettier/bin/prettier.cjs",
    mode,
    "--ignore-unknown",
    ...paths,
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

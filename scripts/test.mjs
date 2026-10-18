import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

export function testFiles(suite, root = "tests") {
  if (!["all", "contracts", "runtime", "operators"].includes(suite))
    throw new Error("Select all, contracts, runtime, or operators.");
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = join(directory, entry.name);
      return entry.isDirectory()
        ? walk(file)
        : file.endsWith(".test.ts")
          ? [file]
          : [];
    });
  return walk(root)
    .filter((file) => {
      const path = relative(root, file).replaceAll("\\", "/");
      const group =
        path === "contracts.test.ts"
          ? "contracts"
          : path.startsWith("runtime/")
            ? "runtime"
            : "operators";
      return suite === "all" || suite === group;
    })
    .sort();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  try {
    const suite = process.argv[2] ?? "all";
    const files = testFiles(suite);
    if (["all", "contracts"].includes(suite)) {
      run("npm", ["run", "build"]);
      run("npm", ["run", "bundle"]);
    }
    if (["all", "runtime"].includes(suite))
      run(process.execPath, ["scripts/build-tests.mjs"]);
    run(process.execPath, [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      ...process.argv.slice(3),
      ...files,
    ]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

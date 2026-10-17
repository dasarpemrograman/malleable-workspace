import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const ids = process.argv.slice(2);
for (const id of ids) {
  const state = JSON.parse(
    execFileSync(
      "node_modules/.bin/openspec",
      ["instructions", "apply", "--change", "workspace-mvp", "--json"],
      { env: { ...process.env, OPENSPEC_TELEMETRY: "0" }, encoding: "utf8" },
    ),
  );
  const task = state.tasks.find((t) => t.description.startsWith(id + " "));
  if (!task) throw new Error("Unknown task " + id);
  if (task.done) continue;
  const lines = readFileSync(task.sourcePath, "utf8").split("\n");
  if (lines[task.line - 1] !== `- [ ] ${task.description}`)
    throw new Error("Task moved; refresh before editing.");
  lines[task.line - 1] = `- [x] ${task.description}`;
  writeFileSync(task.sourcePath, lines.join("\n"));
  const next = JSON.parse(
    execFileSync(
      "node_modules/.bin/openspec",
      ["instructions", "apply", "--change", "workspace-mvp", "--json"],
      { env: { ...process.env, OPENSPEC_TELEMETRY: "0" }, encoding: "utf8" },
    ),
  );
  if (!next.tasks.find((t) => t.id === task.id)?.done)
    throw new Error("Progress did not change");
  console.log(
    `${id} complete (${next.progress.complete}/${next.progress.total})`,
  );
}

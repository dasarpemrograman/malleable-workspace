import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
await rm(".wrangler/browser-tests", { recursive: true, force: true });
const build = spawn("npm", ["run", "build"], { stdio: "inherit" });
await new Promise((resolve, reject) =>
  build.on("exit", (c) =>
    c === 0 ? resolve() : reject(new Error("Build failed")),
  ),
);
const server = spawn(
  "node_modules/.bin/wrangler",
  [
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    "8788",
    "--persist-to",
    ".wrangler/browser-tests",
  ],
  {
    stdio: "inherit",
    detached: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (server.pid) {
      try {
        process.kill(-server.pid, signal);
      } catch {
        server.kill(signal);
      }
    }
  });
await new Promise((resolve) => server.on("exit", resolve));

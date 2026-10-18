import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function availablePort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("MW_DEV_PORT must be an integer from 1 to 65535.");
  const probe = createServer();
  await new Promise((accept, reject) => {
    probe.once("error", () =>
      reject(
        new Error(
          `Port ${port} is occupied; stop the other server or choose MW_DEV_PORT.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(accept));
  });
}

export async function startDev({
  root = process.cwd(),
  port = Number(process.env.MW_DEV_PORT ?? 8787),
  buildClient,
  spawnWorker,
  signal,
} = {}) {
  await availablePort(port);
  let watcher,
    child,
    stopping = false,
    starting = false;
  let finish;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  let shutdown;
  const close = (code = 0) =>
    (shutdown ??= (async () => {
      stopping = true;
      await watcher?.close();
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        const kill = (signal) => {
          try {
            if (process.platform !== "win32" && child.pid)
              process.kill(-child.pid, signal);
            else child.kill(signal);
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        };
        kill("SIGTERM");
        const timer = setTimeout(() => kill("SIGKILL"), 5000);
        timer.unref();
        await exited;
        clearTimeout(timer);
      }
      finish(code);
    })());
  const start = () => {
    if (starting || stopping) return;
    starting = true;
    child = spawnWorker
      ? spawnWorker()
      : spawn(
          process.execPath,
          [
            join(root, "node_modules/wrangler/bin/wrangler.js"),
            "dev",
            "--local",
            "--ip",
            "127.0.0.1",
            "--port",
            String(port),
            "--persist-to",
            ".wrangler/state",
          ],
          {
            cwd: root,
            stdio: "inherit",
            detached: process.platform !== "win32",
          },
        );
    child.once("error", (error) => {
      console.error(error.message);
      void close(1);
    });
    child.once("exit", (code, signal) => {
      if (!stopping) {
        console.error(`Local Worker stopped unexpectedly (${signal ?? code}).`);
        void close(1);
      }
    });
  };
  signal?.addEventListener(
    "abort",
    () => {
      void close(0);
    },
    { once: true },
  );
  if (signal?.aborted) return { close, finished: Promise.resolve(0) };
  try {
    const build = buildClient ?? (await import("vite")).build;
    watcher = await build({
      root,
      build: { watch: {} },
      plugins: [
        { name: "start-local-worker-after-client-build", writeBundle: start },
      ],
    });
    watcher.on("event", (event) => {
      if (event.code === "ERROR")
        console.error(`Client build failed: ${event.error.message}`);
    });
    if (stopping) await watcher.close();
  } catch (error) {
    await close(1);
    throw error;
  }
  return { close, finished };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (Number(process.versions.node.split(".")[0]) < 24)
      throw new Error("Use Node 24 or newer; run nvm use before npm ci.");
    if (!existsSync(".dev.vars"))
      throw new Error("Run npm run setup:local before development.");
    const abort = new AbortController();
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        abort.abort();
      });
    const controller = await startDev({ signal: abort.signal });
    process.exitCode = await controller.finished;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

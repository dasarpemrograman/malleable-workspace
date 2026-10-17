import { build } from "esbuild";
await build({
  entryPoints: ["tests/fixture-worker.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  external: ["cloudflare:workers"],
  outfile: ".worker/test.js",
});

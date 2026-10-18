import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareUpdate, git } from "./lib/git-update.mjs";
import {
  CANONICAL,
  UpdateError,
  repository,
  upstreamSchema,
  readMetadata,
} from "./lib/update-model.mjs";

export function prepareFromArgs(args) {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      repo: { type: "string" },
      downstream: { type: "string" },
      source: { type: "string" },
      ref: { type: "string" },
      baseline: { type: "string" },
      target: { type: "string" },
      output: { type: "string" },
      deployment: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help)
    return {
      help: "node scripts/upstream-update.mjs --repo OWNER/COPY [--downstream /clean/checkout] [--baseline FULL_SHA] [--target FULL_SHA] [--deployment /private/enrollment.json] [--output /new/directory]",
    };
  let id = values.repo;
  const local = values.downstream && resolve(values.downstream);
  if (!id && local) {
    try {
      const url = git(local, ["remote", "get-url", "origin"]).trim();
      id = url.match(
        /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/,
      )?.[1];
    } catch {
      /* Local fixtures may have no remote. */
    }
  }
  if (id) repository.parse(id);
  if (!id && !local)
    throw new UpdateError(
      "repository_required",
      "Provide --repo OWNER/COPY or --downstream /clean/checkout.",
    );
  const metadata = local
    ? readMetadata(local, ".workspace/upstream.json", upstreamSchema)
    : null;
  const source = values.source ?? metadata?.repository ?? CANONICAL;
  const downstream = local ?? `https://github.com/${id}.git`;
  return prepareUpdate({
    downstream,
    downstreamId: id,
    source,
    ref: values.ref,
    baseline: values.baseline,
    target: values.target,
    output: values.output,
    deployment: values.deployment
      ? JSON.parse(readFileSync(resolve(values.deployment), "utf8"))
      : undefined,
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(prepareFromArgs(process.argv.slice(2)), null, 2),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          status: "blocked",
          code: error instanceof UpdateError ? error.code : "invalid_input",
          message:
            error instanceof UpdateError
              ? error.message
              : "Check arguments, metadata and source access.",
          ...(error instanceof UpdateError ? error.details : {}),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

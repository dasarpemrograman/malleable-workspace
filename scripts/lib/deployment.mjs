import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  deploymentSchema,
  upstreamSchema,
  readMetadata,
  parseConfig,
  safePath,
  requireUpdate,
  validateMigrations,
  UpdateError,
} from "./update-model.mjs";

export function checkDestination(root, config, enrollment, env = process.env) {
  deploymentSchema.parse(enrollment);
  requireUpdate(
    config.name === enrollment.workerName &&
      (!config.account_id || config.account_id === enrollment.accountId),
    "identity_mismatch",
    "Repository account/Worker differs from deployment enrollment.",
  );
  for (const key of ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"])
    requireUpdate(
      !env[key] || env[key] === enrollment.accountId,
      "identity_mismatch",
      "Cloudflare account override differs from enrollment.",
    );
  requireUpdate(
    !env.WRANGLER_CI_OVERRIDE_NAME ||
      env.WRANGLER_CI_OVERRIDE_NAME === enrollment.workerName,
    "identity_mismatch",
    "Workers Builds Worker override differs from enrollment.",
  );
  requireUpdate(
    !env.WORKERS_CI_BRANCH ||
      env.WORKERS_CI_BRANCH === enrollment.productionBranch,
    "preview_blocked",
    "Only the enrolled production branch may deploy this workspace.",
  );
  if (env.GITHUB_ACTIONS === "true")
    requireUpdate(
      env.GITHUB_REF === `refs/heads/${enrollment.productionBranch}`,
      "preview_blocked",
      "GitHub deployment must use the enrolled production branch.",
    );
  requireUpdate(
    !config.env && !config.routes && !config.route,
    "unsupported_destination",
    "Environment/route changes require a separate reviewed deployment configuration.",
  );
  const bindings = config.durable_objects?.bindings;
  requireUpdate(
    bindings?.length === 1 &&
      bindings[0].name === enrollment.bindingName &&
      bindings[0].class_name === enrollment.className &&
      !bindings[0].script_name &&
      !bindings[0].environment,
    "binding_change",
    "Preserve the existing local WORKSPACE class binding.",
  );
  validateMigrations(
    enrollment.migrations,
    config.migrations,
    enrollment.className,
  );
  const source = readFileSync(safePath(root, config.main), "utf8");
  const routes = source.match(/\.getByName\s*\([^)]*\)/g) ?? [];
  requireUpdate(
    routes.length === 1 &&
      /^\.getByName\s*\(\s*["']primary["']\s*\)$/.test(routes[0]),
    "routing_change",
    "Preserve the reviewed primary object route; alternate routing requires manual enrollment review.",
  );
  return config.migrations.slice(enrollment.migrations.length);
}

export function retainProviderSettings(config, enrollment, provider) {
  const bindings = provider?.resources?.bindings;
  requireUpdate(
    Array.isArray(bindings),
    "preflight_access",
    "Cannot inspect deployed bindings; no upload was attempted.",
  );
  const workspace = bindings.filter(
    (b) =>
      b.type === "durable_object_namespace" &&
      b.name === enrollment.bindingName,
  );
  requireUpdate(
    workspace.length === 1 &&
      workspace[0].namespace_id === enrollment.namespaceId &&
      workspace[0].class_name === enrollment.className,
    "namespace_mismatch",
    "Active namespace/class differs from enrollment; no upload was attempted.",
  );
  requireUpdate(
    bindings.some((b) => b.type === "secret_text" && b.name === "OWNER_KEY"),
    "missing_owner_key",
    "Set OWNER_KEY on the existing Worker before upgrading.",
  );
  const missing = [],
    drift = [];
  for (const [name, value] of Object.entries(config.vars ?? {})) {
    const found = bindings.find(
      (b) => b.name === name && ["plain_text", "json"].includes(b.type),
    );
    if (!found) {
      missing.push(name);
      continue;
    }
    const actual = found.type === "json" ? found.json : found.text;
    // The template default is deliberately not an instruction to erase a dashboard allowlist.
    if (name === "WEBHOOK_ALLOWED_HOSTS" && value === "[]") continue;
    if (JSON.stringify(actual) !== JSON.stringify(value)) drift.push(name);
  }
  requireUpdate(
    !missing.length && !drift.length,
    "configuration_drift",
    "Configure new or differing variables on the existing Worker, then reconcile the reviewed repository configuration. Values are not logged.",
    { missing, drift },
  );
  const result = {
    ...config,
    account_id: enrollment.accountId,
    name: enrollment.workerName,
    keep_vars: true,
    preview_urls: false,
  };
  delete result.vars;
  delete result.$schema;
  return result;
}

// Wrangler JSON commands may surround the JSON response with informational lines.
export function jsonResponse(output) {
  for (let i = 0; i < output.length; i++) {
    if (!"[{".includes(output[i])) continue;
    try {
      return JSON.parse(output.slice(i).trim());
    } catch {
      /* try the next JSON start */
    }
  }
  throw new UpdateError(
    "preflight_access",
    "Cloudflare did not return inspectable JSON; no upload was attempted.",
  );
}
function execute(root, command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}
export function inspectProvider(root, path) {
  try {
    const run = (args) =>
      jsonResponse(
        execute(root, process.execPath, [
          join(root, "node_modules/wrangler/bin/wrangler.js"),
          ...args,
          "--config",
          path,
        ]),
      );
    const deployments = run(["deployments", "list", "--json"]);
    requireUpdate(
      Array.isArray(deployments) && deployments.length > 0,
      "preflight_access",
      "No active deployment is available for inspection.",
    );
    const latest = [...deployments].sort((a, b) =>
      String(b.created_on).localeCompare(String(a.created_on)),
    )[0];
    requireUpdate(
      latest.versions?.length === 1 && latest.versions[0].percentage === 100,
      "gradual_deployment",
      "Finish or roll back the active gradual deployment before updating.",
    );
    return run(["versions", "view", latest.versions[0].version_id, "--json"]);
  } catch (error) {
    if (error instanceof UpdateError) throw error;
    throw new UpdateError(
      "preflight_access",
      "Cannot inspect the enrolled Worker. Authenticate Wrangler with read/deploy access to that account; no upload was attempted.",
    );
  }
}

export function deployWorkspace({
  root = process.cwd(),
  dryRun = false,
  env = process.env,
  inspect = inspectProvider,
  check,
  upload,
} = {}) {
  requireUpdate(
    Number(process.versions.node.split(".")[0]) >= 24,
    "toolchain",
    "Deployment requires Node 24 or newer.",
  );
  const config = parseConfig(
    readFileSync(safePath(root, "wrangler.jsonc"), "utf8"),
  );
  const provenance = readMetadata(
    root,
    ".workspace/upstream.json",
    upstreamSchema,
  );
  const enrollment = readMetadata(
    root,
    ".workspace/deployment.json",
    deploymentSchema,
  );
  requireUpdate(
    !provenance || enrollment,
    "enrollment_required",
    "Enroll the existing hosted destination in .workspace/deployment.json before deploying an imported copy. Local development remains available.",
  );
  const temporary = mkdtempSync(join(tmpdir(), "workspace-deploy-"));
  try {
    let effective = config;
    let migrations = [];
    const file = join(temporary, "wrangler.json");
    if (enrollment) {
      migrations = checkDestination(root, config, enrollment, env);
      writeFileSync(
        file,
        JSON.stringify({
          account_id: enrollment.accountId,
          name: enrollment.workerName,
          compatibility_date: config.compatibility_date,
        }),
      );
      effective = retainProviderSettings(
        config,
        enrollment,
        inspect(root, file),
      );
    } else {
      requireUpdate(
        !env.WRANGLER_CI_OVERRIDE_NAME ||
          env.WRANGLER_CI_OVERRIDE_NAME === config.name,
        "identity_mismatch",
        "Fresh deployment Worker override must agree with wrangler.jsonc.",
      );
      requireUpdate(
        !env.WORKERS_CI_BRANCH ||
          !env.WORKERS_CI_DEFAULT_BRANCH ||
          env.WORKERS_CI_BRANCH === env.WORKERS_CI_DEFAULT_BRANCH,
        "preview_blocked",
        "Disable preview deployments or use an explicitly isolated test destination.",
      );
    }
    // All relative source/asset paths resolve from the repository, never the temporary config directory.
    delete effective.$schema;
    effective = {
      ...effective,
      main: safePath(root, config.main),
      preview_urls: false,
    };
    if (config.assets)
      effective.assets = {
        ...config.assets,
        directory: safePath(root, config.assets.directory),
      };
    writeFileSync(file, JSON.stringify(effective, null, 2), { mode: 0o600 });
    const checks =
      check ??
      (() => {
        execute(root, "npm", ["run", "typecheck"], { stdio: "inherit", env });
        execute(root, "npm", ["test"], { stdio: "inherit", env });
      });
    checks();
    const args = ["deploy", "--config", file, ...(dryRun ? ["--dry-run"] : [])];
    if (enrollment) args.push("--keep-vars");
    const send =
      upload ??
      ((args) =>
        execute(
          root,
          process.execPath,
          [join(root, "node_modules/wrangler/bin/wrangler.js"), ...args],
          { stdio: "inherit", env },
        ));
    send(args);
    return {
      status: dryRun ? "validated-dry-run" : "uploaded",
      enrolled: Boolean(enrollment),
      additiveMigrations: migrations.map((m) => m.tag),
      deployed: !dryRun,
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

import { readFileSync, lstatSync } from "node:fs";
import { resolve, sep } from "node:path";
import { parse } from "jsonc-parser";
import { z } from "zod";

export const CANONICAL = "dasarpemrograman/malleable-workspace";
export const OWNER_FILES = [
  ".workspace/upstream.json",
  ".workspace/deployment.json",
];
export const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const repository = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/);
export const trackingRef = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .refine(
    (v) =>
      !v.includes("..") &&
      !v.includes("//") &&
      !v.endsWith("/") &&
      !v.endsWith(".") &&
      !v.endsWith(".lock"),
    "Use a literal branch, tag, or full commit SHA.",
  );
const identifier = z.string().regex(/^[a-f0-9]{32}$/);
const workerName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);
export const upstreamSchema = z
  .object({
    version: z.literal(1),
    repository,
    ref: trackingRef,
    importedCommit: sha,
  })
  .strict();
const migration = z
  .object({
    tag: z.string().min(1).max(100),
    new_classes: z.array(z.string()).optional(),
    new_sqlite_classes: z.array(z.string()).optional(),
    renamed_classes: z
      .array(z.object({ from: z.string(), to: z.string() }).strict())
      .optional(),
    deleted_classes: z.array(z.string()).optional(),
  })
  .strict();
export const deploymentSchema = z
  .object({
    version: z.literal(1),
    accountId: identifier,
    workerName,
    namespaceId: identifier,
    bindingName: z.literal("WORKSPACE"),
    className: z.literal("Workspace"),
    objectName: z.literal("primary"),
    productionBranch: trackingRef,
    migrations: z.array(migration).min(1),
  })
  .strict();

export class UpdateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "UpdateError";
    this.code = code;
    this.details = details;
  }
}
export function requireUpdate(condition, code, message, details) {
  if (!condition) throw new UpdateError(code, message, details);
}
export function safePath(root, relative) {
  const base = resolve(root);
  const path = resolve(base, relative);
  requireUpdate(
    path.startsWith(base + sep),
    "unsafe_path",
    "Path must stay inside the repository.",
  );
  let current = base;
  for (const component of path.slice(base.length + 1).split(sep)) {
    current = resolve(current, component);
    try {
      requireUpdate(
        !lstatSync(current).isSymbolicLink(),
        "unsafe_path",
        "Metadata/configuration paths cannot be symlinks.",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return path;
}
export function parseConfig(text) {
  const errors = [];
  const value = parse(text, errors, { allowTrailingComma: true });
  requireUpdate(
    errors.length === 0 &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value),
    "invalid_config",
    "Expected a JSON/JSONC configuration object.",
  );
  return value;
}
export function readMetadata(root, file, schema) {
  try {
    const text = readFileSync(safePath(root, file), "utf8");
    requireUpdate(
      Buffer.byteLength(text) <= 65536,
      "invalid_metadata",
      "Metadata exceeds 64 KiB.",
    );
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error instanceof UpdateError) throw error;
    throw new UpdateError(
      "invalid_metadata",
      `Invalid ${file}; check the documented version 1 format.`,
    );
  }
}
export function validateMigrations(previous, next, className = "Workspace") {
  requireUpdate(
    Array.isArray(next) && next.length >= previous.length,
    "migration_change",
    "Existing migration history cannot be removed.",
  );
  previous.forEach((item, i) =>
    requireUpdate(
      JSON.stringify(item) === JSON.stringify(next[i]),
      "migration_change",
      "Existing migration entries must stay unchanged and in order.",
    ),
  );
  const tags = new Set();
  for (const item of next) {
    migration.parse(item);
    requireUpdate(
      !tags.has(item.tag),
      "migration_change",
      "Migration tags must be unique.",
    );
    tags.add(item.tag);
  }
  for (const item of next.slice(previous.length)) {
    requireUpdate(
      !item.deleted_classes?.length,
      "migration_change",
      "Namespace deletion requires a separate migration review.",
    );
    requireUpdate(
      !item.renamed_classes?.some(
        (entry) => entry.from === className || entry.to === className,
      ),
      "migration_change",
      "Renaming the workspace class requires a separate migration review.",
    );
    requireUpdate(
      ![
        ...(item.new_classes ?? []),
        ...(item.new_sqlite_classes ?? []),
      ].includes(className),
      "migration_change",
      "An update cannot recreate the existing workspace class.",
    );
  }
}
export function validateConfigTransition(previous, next) {
  validateMigrations(previous.migrations ?? [], next.migrations);
  const binding = (cfg) =>
    cfg.durable_objects?.bindings?.find((v) => v.name === "WORKSPACE");
  requireUpdate(
    binding(previous)?.class_name === "Workspace" &&
      JSON.stringify(binding(previous)) === JSON.stringify(binding(next)),
    "binding_change",
    "The established WORKSPACE binding must remain unchanged.",
  );
}

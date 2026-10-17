import { z } from "zod";
export const limits = {
  requestBytes: 1048576,
  snapshotBytes: 10485760,
  name: 240,
  body: 100000,
  text: 10000,
  fieldsPerType: 100,
  optionsPerField: 100,
  pageSize: 100,
  webhookUrl: 2048,
} as const;
export const scopes = [
  "workspace:read",
  "items:write",
  "schema:write",
] as const;
export type Scope = (typeof scopes)[number];
export const id = z.string().uuid();
export const name = z.string().trim().min(1).max(limits.name);
export const revision = z.number().int().positive();
export const value = z.union([
  z.string().max(limits.text),
  z.number().finite(),
  z.boolean(),
]);
export const values = z.record(id, value);
export const base = z.object({
  id,
  revision,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const typeSchema = base.extend({ name }).strict();
export const fieldSchema = base
  .extend({
    typeId: id,
    name,
    kind: z.enum(["text", "number", "checkbox", "select"]),
    archived: z.boolean(),
  })
  .strict();
export const optionSchema = base.extend({ fieldId: id, name }).strict();
export const itemSchema = base
  .extend({
    typeId: id,
    title: name,
    body: z.string().max(limits.body),
    values,
    archived: z.boolean(),
  })
  .strict();
export const viewSchema = base
  .extend({
    mode: z.enum(["list", "board"]),
    typeId: id.nullable(),
    fieldId: id.nullable(),
  })
  .strict();
export type Type = z.infer<typeof typeSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type Option = z.infer<typeof optionSchema>;
export type Item = z.infer<typeof itemSchema>;
export type View = z.infer<typeof viewSchema>;
export type Kind = "type" | "field" | "option" | "item" | "view";
export type Resource = Type | Field | Option | Item | View;
export interface Meta {
  id: string;
  schemaRevision: number;
  pristine: boolean;
  version: number;
}
export const snapshotSchema = z
  .object({
    version: z.literal(1),
    workspace: z
      .object({ id, schemaRevision: z.number().int().positive() })
      .strict(),
    types: z.array(typeSchema).min(1),
    fields: z.array(fieldSchema),
    options: z.array(optionSchema),
    items: z.array(itemSchema),
    views: z.array(viewSchema),
  })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export interface Principal {
  id: string;
  owner: boolean;
  scopes: readonly Scope[];
}
export interface Token {
  id: string;
  name: string;
  digest: string;
  scopes: Scope[];
  createdAt: string;
  revoked: boolean;
}
export interface Session {
  id: string;
  digest: string;
  epoch: string;
  expires: number;
}
export interface Subscription {
  id: string;
  name: string;
  url: string;
  families: ("item" | "schema")[];
  secret: string;
  enabled: boolean;
  origin: string;
  createdAt: string;
}
export interface Event {
  version: 1;
  id: string;
  workspaceId: string;
  type: string;
  resourceId: string;
  resourceRevision: number;
  occurredAt: string;
  actor: string;
  data: Resource | { id: string };
}
export interface Delivery {
  id: string;
  eventId: string;
  subscriptionId: string;
  state: "pending" | "inflight" | "succeeded" | "failed";
  cycle: number;
  attempts: number;
  totalAttempts: number;
  due: number;
  lease: number;
  createdAt: string;
  updatedAt: string;
  outcome: string | null;
}
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireThat(
  ok: unknown,
  code: string,
  message: string,
  status = 422,
): asserts ok {
  if (!ok) throw new AppError(status, code, message);
}
export function fresh() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}
export function validateValues(
  item: Item,
  fields: Field[],
  options: Option[],
  changedKeys = Object.keys(item.values),
  allowArchived = false,
) {
  for (const key of changedKeys) {
    const f = fields.find((f) => f.id === key && f.typeId === item.typeId);
    requireThat(
      f,
      "unknown_field",
      "A field does not belong to this item type.",
    );
    requireThat(
      allowArchived || !f.archived,
      "archived_field",
      "This field is archived. Restore it before writing.",
    );
    if (!Object.hasOwn(item.values, key)) continue;
    const v = item.values[key];
    const valid =
      f.kind === "text"
        ? typeof v === "string"
        : f.kind === "number"
          ? typeof v === "number" && Number.isFinite(v)
          : f.kind === "checkbox"
            ? typeof v === "boolean"
            : typeof v === "string" &&
              options.some((o) => o.fieldId === key && o.id === v);
    requireThat(
      valid,
      "invalid_value",
      `The value does not match the ${f.kind} field.`,
    );
  }
}
export function validateSnapshot(input: unknown): Snapshot {
  const s = snapshotSchema.parse(input);
  const all = [...s.types, ...s.fields, ...s.options, ...s.items, ...s.views];
  requireThat(
    new Set([s.workspace.id, ...all.map((r) => r.id)]).size === all.length + 1,
    "duplicate_id",
    "Snapshot IDs must be unique.",
  );
  for (const f of s.fields)
    requireThat(
      s.types.some((t) => t.id === f.typeId),
      "invalid_reference",
      "Field has no type.",
    );
  for (const o of s.options)
    requireThat(
      s.fields.some((f) => f.id === o.fieldId && f.kind === "select"),
      "invalid_reference",
      "Option has no select field.",
    );
  for (const t of s.types)
    requireThat(
      s.fields.filter((f) => f.typeId === t.id).length <= limits.fieldsPerType,
      "field_limit",
      "Too many fields.",
    );
  for (const f of s.fields)
    requireThat(
      s.options.filter((o) => o.fieldId === f.id).length <=
        limits.optionsPerField,
      "option_limit",
      "Too many options.",
    );
  for (const i of s.items) {
    requireThat(
      s.types.some((t) => t.id === i.typeId),
      "invalid_reference",
      "Item has no type.",
    );
    validateValues(i, s.fields, s.options, undefined, true);
  }
  for (const v of s.views) {
    requireThat(
      v.typeId === null || s.types.some((t) => t.id === v.typeId),
      "invalid_reference",
      "View has no type.",
    );
    requireThat(
      v.fieldId === null ||
        s.fields.some(
          (f) =>
            f.id === v.fieldId && f.typeId === v.typeId && f.kind === "select",
        ),
      "invalid_reference",
      "View has no select field.",
    );
  }
  return s;
}

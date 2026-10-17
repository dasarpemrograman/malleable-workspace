import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  typeSchema,
  fieldSchema,
  optionSchema,
  itemSchema,
  name,
  id,
  revision,
  limits,
  value,
} from "../src/domain/model";
const ref = (name: string) => ({ $ref: "#/components/schemas/" + name });
const components: Record<string, unknown> = {};
for (const [key, schema] of Object.entries({
  Type: typeSchema,
  Field: fieldSchema,
  Option: optionSchema,
  Item: itemSchema,
})) {
  const { $schema, ...data } = z.toJSONSchema(schema);
  components[key] = data;
}
const patchValues = z.record(id, value.nullable());
const schema = (s: z.ZodType) => {
  const { $schema, ...data } = z.toJSONSchema(s);
  return data;
};
const error = {
  description: "Machine-readable error",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
  },
};
const operation = (
  summary: string,
  scope: string,
  success: unknown,
  status = "200",
  request?: z.ZodType,
) => ({
  summary,
  description: `Requires ${scope}. Writes are atomic and expected revisions are required for updates.`,
  security: [{ bearerAuth: [] }],
  ...(request
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: schema(request) } },
        },
      }
    : {}),
  responses: {
    [status]: {
      description: "Success",
      content: { "application/json": { schema: success } },
    },
    "400": error,
    "401": error,
    "403": error,
    "404": error,
    "409": error,
    "413": error,
    "422": error,
  },
});
const paths: Record<string, unknown> = {
  "/capabilities": {
    get: operation("Discover stable contracts and limits", "workspace:read", {
      type: "object",
      required: [
        "workspaceId",
        "apiVersion",
        "schemaRevision",
        "eventVersion",
        "fieldKinds",
        "operations",
        "limits",
      ],
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        apiVersion: { const: 1 },
        schemaRevision: { type: "integer" },
        eventVersion: { const: 1 },
        fieldKinds: {
          type: "array",
          items: { enum: ["text", "number", "checkbox", "select"] },
        },
        operations: { type: "array", items: { type: "string" } },
        limits: { type: "object" },
      },
    }),
  },
  "/schema": {
    get: operation(
      "Read definitions, including archived fields",
      "workspace:read",
      {
        type: "object",
        required: ["revision", "types", "fields", "options"],
        properties: {
          revision: { type: "integer" },
          types: { type: "array", items: ref("Type") },
          fields: { type: "array", items: ref("Field") },
          options: { type: "array", items: ref("Option") },
        },
      },
    ),
  },
  "/items": {
    get: {
      ...operation(
        "List items in deterministic cursor order",
        "workspace:read",
        {
          type: "object",
          required: ["items", "nextCursor"],
          properties: {
            items: { type: "array", items: ref("Item") },
            nextCursor: { type: ["string", "null"] },
          },
        },
      ),
      parameters: [
        { name: "q", in: "query", schema: { type: "string", maxLength: 1000 } },
        {
          name: "typeId",
          in: "query",
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "archived",
          in: "query",
          description: "true includes both active and archived items",
          schema: { type: "boolean", default: false },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        },
        { name: "cursor", in: "query", schema: { type: "string" } },
      ],
    },
    post: operation(
      "Create item",
      "items:write",
      ref("Item"),
      "201",
      z
        .object({
          typeId: id,
          title: name,
          body: z.string().max(limits.body).optional(),
          values: z.record(id, value).optional(),
        })
        .strict(),
    ),
  },
  "/items/{id}": {
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: operation("Read an item", "workspace:read", ref("Item")),
    patch: operation(
      "Update, archive, or restore item",
      "items:write",
      ref("Item"),
      "200",
      z
        .object({
          revision,
          title: name.optional(),
          body: z.string().max(limits.body).optional(),
          values: patchValues.optional(),
          archived: z.boolean().optional(),
        })
        .strict(),
    ),
  },
};
for (const [plural, type, create, patch] of [
  [
    "types",
    "Type",
    z.object({ name }).strict(),
    z.object({ revision, name: name.optional() }).strict(),
  ],
  [
    "fields",
    "Field",
    z
      .object({
        typeId: id,
        name,
        kind: z.enum(["text", "number", "checkbox", "select"]),
      })
      .strict(),
    z
      .object({
        revision,
        name: name.optional(),
        archived: z.boolean().optional(),
      })
      .strict(),
  ],
  [
    "options",
    "Option",
    z.object({ fieldId: id, name }).strict(),
    z.object({ revision, name: name.optional() }).strict(),
  ],
] as const) {
  paths["/" + plural] = {
    post: operation(
      "Create " + type.toLowerCase(),
      "schema:write",
      ref(type),
      "201",
      create,
    ),
  };
  paths["/" + plural + "/{id}"] = {
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    patch: operation(
      "Update " + type.toLowerCase(),
      "schema:write",
      ref(type),
      "200",
      patch,
    ),
  };
}
await writeFile(
  "docs/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "Malleable Workspace API",
        version: "1.0.0",
        description:
          "Stable IDs survive supported customization. Scopes are independently granted. Owner-management routes are not part of this bearer API.",
      },
      servers: [
        {
          url: "http://127.0.0.1:8787/api/v1",
          description: "Local; substitute your hosted HTTPS origin as needed.",
        },
      ],
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
        schemas: components,
      },
      paths,
    },
    null,
    2,
  ) + "\n",
);

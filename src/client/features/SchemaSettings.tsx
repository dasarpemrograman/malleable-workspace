import React, { useState } from "react";
import type { Type, Field, Option } from "../../domain/model";
import { api, type Schema } from "../api";
import { Icon } from "../components/Icon";
import { ErrorMessage } from "../components/ErrorMessage";
import { Rename } from "../components/Rename";
import { AddOption } from "./AddOption";
export function SchemaSettings({
  schema,
  reload,
}: {
  schema: Schema;
  reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(schema.types[0]?.id ?? ""),
    [newType, setNewType] = useState(""),
    [newField, setNewField] = useState(""),
    [kind, setKind] = useState("text"),
    [error, setError] = useState("");
  async function write(path: string, method: string, data: unknown) {
    await api(path, method, data);
    await reload();
  }
  return (
    <section>
      <div className="section-heading">
        <span className="eyebrow">BUILDING BLOCKS</span>
        <h1>Make it fit your thinking.</h1>
        <p>Types give your items shape. Fields add just the detail you need.</p>
      </div>
      <ErrorMessage message={error} />
      <div className="settings-card">
        <h2>Your types</h2>
        {schema.types.map((t) => (
          <div className="type-row" key={t.id}>
            <button
              className={selected === t.id ? "selected small" : "small"}
              aria-label={"Configure " + t.name}
              onClick={() => setSelected(t.id)}
            >
              <Icon name="shape" />
            </button>
            <Rename
              label={"Type name " + t.name}
              value={t.name}
              onSave={(v) =>
                write("/api/v1/types/" + t.id, "PATCH", {
                  revision: t.revision,
                  name: v,
                })
              }
            />
          </div>
        ))}
        <form
          className="inline-form new-row"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const t = await api<Type>("/api/v1/types", "POST", {
                name: newType,
              });
              setNewType("");
              setSelected(t.id);
              await reload();
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <input
            aria-label="New type name"
            required
            maxLength={240}
            placeholder="A new way to collect things…"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
          <button>Add type</button>
        </form>
      </div>
      <div className="settings-card">
        <h2>Fields · {schema.types.find((t) => t.id === selected)?.name}</h2>
        <p className="muted">
          Field kinds stay fixed. Archive a field to put it away without losing
          its values.
        </p>
        {schema.fields
          .filter((f) => f.typeId === selected)
          .map((f) => (
            <div className="field-row" key={f.id}>
              <div className="field-header">
                <span className="pill">
                  {f.kind}
                  {f.archived ? " · archived" : ""}
                </span>
                <button
                  className="small"
                  onClick={async () => {
                    try {
                      await write("/api/v1/fields/" + f.id, "PATCH", {
                        revision: f.revision,
                        archived: !f.archived,
                      });
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {f.archived ? "Restore field" : "Archive field"}
                </button>
              </div>
              <Rename
                label={"Field name " + f.name}
                value={f.name}
                onSave={(v) =>
                  write("/api/v1/fields/" + f.id, "PATCH", {
                    revision: f.revision,
                    name: v,
                  })
                }
              />
              {f.kind === "select" && !f.archived && (
                <div className="options">
                  {schema.options
                    .filter((o) => o.fieldId === f.id)
                    .map((o) => (
                      <Rename
                        key={o.id}
                        label={"Option name " + o.name}
                        value={o.name}
                        onSave={(v) =>
                          write("/api/v1/options/" + o.id, "PATCH", {
                            revision: o.revision,
                            name: v,
                          })
                        }
                      />
                    ))}
                  <AddOption
                    field={f}
                    onAdd={async (v) => {
                      await write("/api/v1/options", "POST", {
                        fieldId: f.id,
                        name: v,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        <form
          className="new-row"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await write("/api/v1/fields", "POST", {
                typeId: selected,
                name: newField,
                kind,
              });
              setNewField("");
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="inline-form">
            <input
              aria-label="New field name"
              required
              maxLength={240}
              placeholder="Add a detail, like priority or source…"
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
            />
            <select
              aria-label="Field kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {["text", "number", "checkbox", "select"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <button>Add field</button>
          </div>
        </form>
      </div>
    </section>
  );
}

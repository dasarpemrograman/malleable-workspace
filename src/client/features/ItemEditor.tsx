import React, { useState } from "react";
import type { Type, Field, Option, Item } from "../../domain/model";
import { api, RequestError } from "../api";
import { Icon } from "../components/Icon";
import { Dialog } from "../components/Dialog";
import { ErrorMessage } from "../components/ErrorMessage";
export function ItemEditor({
  item,
  types,
  fields,
  options,
  onClose,
  onSaved,
  onReload,
}: {
  item: Item | null;
  types: Type[];
  fields: Field[];
  options: Option[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onReload: (id: string) => Promise<Item>;
}) {
  const [draft, setDraft] = useState(() => ({
    typeId: item?.typeId ?? types[0]?.id ?? "",
    title: item?.title ?? "",
    body: item?.body ?? "",
    values: { ...item?.values } as Record<string, string | number | boolean>,
    revision: item?.revision,
  }));
  const [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [busy, setBusy] = useState(false);
  const setValue = (id: string, v: string | number | boolean | null) =>
    setDraft((d) => {
      const values = { ...d.values };
      if (v === null) delete values[id];
      else values[id] = v;
      return { ...d, values };
    });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { revision, typeId, ...data } = draft;
      const edits: Record<string, unknown> = { ...draft.values };
      if (item)
        for (const key of Object.keys(item.values)) {
          if (!Object.hasOwn(draft.values, key)) edits[key] = null;
        }
      // Only active fields are sent; archived values remain stored and read-only.
      const writable = Object.fromEntries(
        Object.entries(edits).filter(([key]) =>
          fields.some((f) => f.id === key && !f.archived),
        ),
      );
      await api(
        "/api/v1/items" + (item ? "/" + item.id : ""),
        item ? "PATCH" : "POST",
        item
          ? { ...data, values: writable, revision }
          : { ...data, values: writable, typeId },
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setConflict(e instanceof RequestError && e.code === "revision_conflict");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={item ? "Edit item" : "Make room for an idea"}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <label>
          Type
          <select
            aria-label="Type"
            value={draft.typeId}
            disabled={!!item}
            onChange={(e) =>
              setDraft((d) => ({ ...d, typeId: e.target.value, values: {} }))
            }
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            autoFocus
            required
            maxLength={240}
            placeholder="Give it a name…"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </label>
        <label>
          Notes
          <textarea
            rows={5}
            maxLength={100000}
            placeholder="Start anywhere. This space is yours."
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          />
        </label>
        {fields
          .filter((f) => f.typeId === draft.typeId && !f.archived)
          .map((f) => (
            <label key={f.id}>
              {f.name}
              {f.kind === "select" ? (
                <select
                  aria-label={f.name}
                  value={String(draft.values[f.id] ?? "")}
                  onChange={(e) => setValue(f.id, e.target.value || null)}
                >
                  <option value="">Unset</option>
                  {options
                    .filter((o) => o.fieldId === f.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
              ) : f.kind === "checkbox" ? (
                <select
                  aria-label={f.name}
                  value={
                    draft.values[f.id] === undefined
                      ? ""
                      : String(draft.values[f.id])
                  }
                  onChange={(e) =>
                    setValue(
                      f.id,
                      e.target.value === "" ? null : e.target.value === "true",
                    )
                  }
                >
                  <option value="">Unset</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={f.kind === "number" ? "number" : "text"}
                  step={f.kind === "number" ? "any" : undefined}
                  maxLength={10000}
                  value={String(draft.values[f.id] ?? "")}
                  onChange={(e) =>
                    setValue(
                      f.id,
                      e.target.value === ""
                        ? null
                        : f.kind === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    )
                  }
                />
              )}
            </label>
          ))}
        <ErrorMessage message={error} />
        {conflict && item && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Replace your draft with the latest saved record?"))
                return;
              try {
                const i = await onReload(item.id);
                setDraft({
                  typeId: i.typeId,
                  title: i.title,
                  body: i.body,
                  values: i.values,
                  revision: i.revision,
                });
                setConflict(false);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Reload saved record
          </button>
        )}
        <footer className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save item"}
            <Icon name="arrow" />
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

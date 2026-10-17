import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Type,
  Field,
  Option,
  Item,
  View,
  Scope,
  Token,
  Subscription,
  Delivery,
} from "../domain/model";
import "./style.css";
type Schema = {
  types: Type[];
  fields: Field[];
  options: Option[];
  revision: number;
};
type Session = {
  owner: boolean;
  workspace: { id: string; pristine: boolean };
  environment: string;
  apiUrl: string;
};
class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const v = (await r.json()) as { error?: { message: string; code: string } };
  if (!r.ok)
    throw new RequestError(
      v.error?.message ?? "The request failed.",
      v.error?.code ?? "request_failed",
    );
  return v as T;
}
function Icon({
  name,
  ...props
}: { name: string } & React.SVGProps<SVGSVGElement>) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    plus: "M12 5v14 M5 12h14",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    connect:
      "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
    shape: "M12 3l10 18H2z",
    list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.1 M3 12h.1 M3 18h.1",
    board: "M3 4h5v16H3z M10 4h5v10h-5z M17 4h5v13h-5z",
    archive: "M3 3h18v5H3z M5 8v13h14V8 M10 12h4",
    close: "M6 6l12 12 M6 18L18 6",
    restore: "M3 10a9 9 0 1 1 0 6 M3 4v6h6",
    logout: "M9 3H3v18h6 M10 12h11 M16 7l5 5-5 5",
  };
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <header className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
function Rename({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState("");
  useEffect(() => setDraft(value), [value]);
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSave(draft);
          setError("");
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <input
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={240}
        required
      />
      <button className="small" disabled={draft === value}>
        Save name
      </button>
      <ErrorMessage message={error} />
    </form>
  );
}
function ItemEditor({
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
function SchemaSettings({
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
function AddOption({
  field,
  onAdd,
}: {
  field: Field;
  onAdd: (s: string) => Promise<void>;
}) {
  const [v, setV] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onAdd(v);
          setV("");
          setError("");
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <div className="inline-form">
        <input
          aria-label={"New option for " + field.name}
          placeholder="New option"
          value={v}
          required
          maxLength={240}
          onChange={(e) => setV(e.target.value)}
        />
        <button className="small">Add option</button>
      </div>
      <ErrorMessage message={error} />
    </form>
  );
}
function Connections({ session }: { session: Session }) {
  const [tokens, setTokens] = useState<Omit<Token, "digest">[]>([]),
    [connections, setConnections] = useState<{
      allowedHosts: string[];
      subscriptions: Omit<Subscription, "secret">[];
    }>({ allowedHosts: [], subscriptions: [] }),
    [deliveries, setDeliveries] = useState<
      (Delivery & { destination: string })[]
    >([]),
    [error, setError] = useState(""),
    [issued, setIssued] = useState<{ title: string; value: string } | null>(
      null,
    ),
    [tokenName, setTokenName] = useState(""),
    [selectedScopes, setSelectedScopes] = useState<Scope[]>(["workspace:read"]),
    [subName, setSubName] = useState(""),
    [url, setUrl] = useState(""),
    [families, setFamilies] = useState<string[]>(["item"]);
  async function load() {
    const [t, c, d] = await Promise.all([
      api<Omit<Token, "digest">[]>("/owner/tokens"),
      api<typeof connections>("/owner/connections"),
      api<typeof deliveries>("/owner/deliveries"),
    ]);
    setTokens(t);
    setConnections(c);
    setDeliveries(d);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const n = setInterval(() => load().catch((e) => setError(e.message)), 5000);
    return () => clearInterval(n);
  }, []);
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <span className="eyebrow">OPEN BY DESIGN</span>
        <h1>A workspace that reaches out.</h1>
        <p>Let your tools work here, and send changes where they belong.</p>
      </div>
      <ErrorMessage message={error} />
      <div className="api-address">
        <span className="status-dot" />
        {session.environment === "local" ? "LOCAL API" : "HOSTED HTTPS API"}
        <code>{session.apiUrl}</code>
      </div>
      <p className="muted">
        {session.environment === "local"
          ? "Tools on this device can connect. Local and cloud workspaces have separate data."
          : "External services can connect over HTTPS with a scoped token. Local data is not automatically synchronized."}
      </p>
      <div className="settings-card">
        <h2>Access tokens</h2>
        <p className="muted">
          Give each tool its own access. Secrets appear once; revoke a token any
          time.
        </p>
        {tokens.map((t) => (
          <div className="connection-row" key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <small>
                {t.scopes.join(" · ")}
                {t.revoked ? " · Revoked" : ""}
              </small>
            </div>
            {!t.revoked && (
              <button
                className="small"
                onClick={() =>
                  action(() =>
                    api("/owner/tokens/" + t.id, "PATCH", { revoked: true }),
                  )
                }
              >
                Revoke
              </button>
            )}
          </div>
        ))}
        <form
          className="new-row"
          onSubmit={(e) => {
            e.preventDefault();
            action(async () => {
              const r = await api<{ secret: string }>("/owner/tokens", "POST", {
                name: tokenName,
                scopes: selectedScopes,
              });
              setIssued({ title: "Your new API token", value: r.secret });
              setTokenName("");
            });
          }}
        >
          <label>
            Token name
            <input
              value={tokenName}
              required
              placeholder="e.g. My research assistant"
              onChange={(e) => setTokenName(e.target.value)}
            />
          </label>
          <div className="checks">
            {(["workspace:read", "items:write", "schema:write"] as Scope[]).map(
              (s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(s)}
                    onChange={(e) =>
                      setSelectedScopes(
                        e.target.checked
                          ? [...selectedScopes, s]
                          : selectedScopes.filter((v) => v !== s),
                      )
                    }
                  />
                  {s}
                </label>
              ),
            )}
          </div>
          <button className="primary" disabled={!selectedScopes.length}>
            Create token
          </button>
        </form>
      </div>
      <div className="settings-card">
        <h2>Outbound webhooks</h2>
        <p className="muted">
          Receivers get signed item or schema snapshots, including their
          content. Use trusted HTTPS receivers. Configure{" "}
          <code>WEBHOOK_ALLOWED_HOSTS</code> in your environment before adding
          one.
        </p>
        <p className="muted">
          Allowed hosts:{" "}
          {connections.allowedHosts.join(", ") || "None configured"}
        </p>
        {connections.subscriptions.map((s) => (
          <div className="connection-row" key={s.id}>
            <div>
              <strong>{s.name}</strong>
              <small>{s.url}</small>
              <small>
                {s.enabled ? "Enabled" : "Disabled"} · {s.families.join(", ")}
              </small>
            </div>
            <button
              className="small"
              onClick={() =>
                action(() =>
                  api("/owner/subscriptions/" + s.id, "PATCH", {
                    enabled: !s.enabled,
                  }),
                )
              }
            >
              {s.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
        <form
          className="new-row"
          onSubmit={(e) => {
            e.preventDefault();
            action(async () => {
              const r = await api<Subscription>(
                "/owner/subscriptions",
                "POST",
                { name: subName, url, families },
              );
              setIssued({
                title: "Your webhook signing secret",
                value: r.secret,
              });
              setSubName("");
              setUrl("");
            });
          }}
        >
          <label>
            Receiver name
            <input
              value={subName}
              required
              onChange={(e) => setSubName(e.target.value)}
            />
          </label>
          <label>
            Receiver URL
            <input
              type="url"
              required
              placeholder="https://your-service.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className="checks">
            {["item", "schema"].map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  checked={families.includes(f)}
                  onChange={(e) =>
                    setFamilies(
                      e.target.checked
                        ? [...families, f]
                        : families.filter((v) => v !== f),
                    )
                  }
                />
                {f} events
              </label>
            ))}
          </div>
          <button disabled={!families.length}>Add receiver</button>
        </form>
      </div>
      <div className="settings-card">
        <h2>Delivery activity</h2>
        {!deliveries.length ? (
          <p className="muted">
            Future changes will appear here after you connect a receiver.
          </p>
        ) : (
          deliveries.map((d) => (
            <div className="delivery" key={d.id}>
              <div>
                <strong>{d.state}</strong>{" "}
                <span className="muted">{d.outcome ?? "Waiting"}</span>
                <small>{d.destination}</small>
                <small>
                  Event {d.eventId} · {d.attempts}/3 attempts this cycle ·{" "}
                  {d.totalAttempts} total ·{" "}
                  {new Date(d.updatedAt).toLocaleString()}
                </small>
              </div>
              {d.state === "failed" && (
                <button
                  className="small"
                  onClick={() =>
                    action(() =>
                      api("/owner/deliveries/" + d.id + "/retry", "POST", {}),
                    )
                  }
                >
                  Retry
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {issued && (
        <Dialog title={issued.title} onClose={() => setIssued(null)}>
          <p>Save this secret now. It will not be shown again.</p>
          <textarea readOnly aria-label="New secret" value={issued.value} />
          <footer className="dialog-actions">
            <button onClick={() => setIssued(null)}>I saved it</button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
function Recovery({ reload }: { reload: () => Promise<void> }) {
  const [error, setError] = useState(""),
    [snapshot, setSnapshot] = useState<unknown>(null),
    [message, setMessage] = useState("");
  return (
    <section>
      <div className="section-heading">
        <span className="eyebrow">YOURS TO KEEP</span>
        <h1>Take your workspace with you.</h1>
        <p>
          Move between a local instance and Cloudflare with a portable snapshot.
        </p>
      </div>
      <ErrorMessage message={error} />
      <p role="status">{message}</p>
      <div className="settings-card">
        <h2>Export your workspace</h2>
        <p className="muted">
          Includes types, fields, items, archived content, and views. Tokens,
          sessions, receiver secrets, and delivery history stay behind. Maximum
          10 MiB.
        </p>
        <a className="button" href="/owner/export" download>
          Download snapshot <Icon name="arrow" />
        </a>
      </div>
      <div className="settings-card">
        <h2>Restore into a fresh workspace</h2>
        <p className="muted">
          Restore replaces the starting defaults. It is available only before
          you create content, change views or schema, or configure connections.
          Your current owner key stays in place.
        </p>
        <p className="muted">
          This does not enable synchronization. When replacing an instance,
          retire the source to avoid running two independent copies with the
          same identity.
        </p>
        <label>
          Choose JSON snapshot
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 10485760)
                  throw new Error("Snapshot exceeds 10 MiB.");
                setSnapshot(JSON.parse(await f.text()));
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </label>
        <button
          className="danger"
          disabled={!snapshot}
          onClick={async () => {
            if (
              !confirm(
                "Replace the fresh defaults with this snapshot? Your current owner key stays; old connections will not be restored.",
              )
            )
              return;
            try {
              await api("/owner/restore", "POST", snapshot);
              setSnapshot(null);
              setMessage(
                "Workspace restored. Configure new connections when you are ready.",
              );
              await reload();
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Restore snapshot
        </button>
      </div>
    </section>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState("workspace"),
    [schema, setSchema] = useState<Schema>({
      types: [],
      fields: [],
      options: [],
      revision: 1,
    }),
    [items, setItems] = useState<Item[]>([]),
    [view, setView] = useState<View | null>(null),
    [prefs, setPrefs] = useState({ mode: "list", typeId: "", fieldId: "" }),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [editor, setEditor] = useState<Item | null | undefined>(undefined),
    [loading, setLoading] = useState(false);
  const loadSequence = useRef(0);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  async function load(initialize = false) {
    const seq = ++loadSequence.current;
    const [s, views] = await Promise.all([
      api<Schema>("/api/v1/schema"),
      api<View[]>("/owner/views"),
    ]);
    const list: Item[] = [];
    let cursor: string | null = null;
    do {
      const r: { items: Item[]; nextCursor: string | null } = await api<{
        items: Item[];
        nextCursor: string | null;
      }>(
        "/api/v1/items?archived=true&limit=100" +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      );
      list.push(...r.items);
      cursor = r.nextCursor;
    } while (cursor);
    if (seq !== loadSequence.current) return;
    setSchema(s);
    setItems(list);
    setView(views[0] ?? null);
    if (initialize && views[0])
      setPrefs({
        mode: views[0].mode,
        typeId: views[0].typeId ?? "",
        fieldId: views[0].fieldId ?? "",
      });
  }
  useEffect(() => {
    api<Session>("/auth/session")
      .then(async (s) => {
        setSession(s);
        await load(true);
      })
      .catch((e) => {
        if (e.code !== "unauthenticated") setError(e.message);
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        load().catch((e) => setError(e.message));
    };
    const n = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(n);
      window.removeEventListener("focus", refresh);
    };
  }, [session]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/auth/login", "POST", { key });
      setKey("");
      const s = await api<Session>("/auth/session");
      setSession(s);
      await load(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function changePrefs(next: typeof prefs) {
    setPrefs(next);
    try {
      const saved = await api<View>(
        "/owner/views" + (view ? "/" + view.id : ""),
        view ? "PATCH" : "POST",
        {
          ...(view ? { revision: view.revision } : {}),
          mode: next.mode,
          typeId: next.typeId || null,
          fieldId: next.fieldId || null,
        },
      );
      setView(saved);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function edit(item: Item, change: Record<string, unknown>) {
    try {
      await api("/api/v1/items/" + item.id, "PATCH", {
        revision: item.revision,
        ...change,
      });
      await load();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!ready) return <div className="loading-screen">Opening your space…</div>;
  if (!session)
    return (
      <main className="login">
        <div className="brand">
          <span className="brand-mark">m</span>malleable
          <span className="beta">WORKSPACE</span>
        </div>
        <div className="login-card">
          <span className="eyebrow">A SPACE OF YOUR OWN</span>
          <h1>
            Make yourself
            <br />
            at home.
          </h1>
          <p>
            A quiet place for your ideas, projects, and whatever comes next.
          </p>
          <form onSubmit={login}>
            <label>
              Owner key
              <input
                type="password"
                required
                autoComplete="current-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your private owner key"
              />
            </label>
            <ErrorMessage message={error} />
            <button className="primary" disabled={loading}>
              {loading ? "Opening…" : "Open workspace"}
              <Icon name="arrow" />
            </button>
          </form>
          <small>
            Local setup? Your owner key is in <code>.dev.vars</code>.<br />
            Hosted? Use the secret you supplied during deployment.
          </small>
        </div>
        <footer>Shape it to your life. Keep it connected.</footer>
      </main>
    );
  const currentType = schema.types.find((t) => t.id === prefs.typeId);
  const grouping = schema.fields.find(
    (f) =>
      f.id === prefs.fieldId &&
      f.typeId === prefs.typeId &&
      !f.archived &&
      f.kind === "select",
  );
  const board = prefs.mode === "board" && !!grouping;
  const active = items.filter(
    (i) =>
      i.archived === archived &&
      (!prefs.typeId || i.typeId === prefs.typeId) &&
      (i.title + " " + i.body).toLowerCase().includes(query.toLowerCase()),
  );
  const selectFields = schema.fields.filter(
    (f) => f.typeId === prefs.typeId && !f.archived && f.kind === "select",
  );
  const columns = [
    { id: "", name: "Unset" },
    ...schema.options.filter((o) => o.fieldId === grouping?.id),
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">m</span>malleable
        </div>
        <div className="space-badge">
          <span className="space-avatar">Y</span>
          <div>
            Your workspace<small>A little room to think</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          <span className="nav-caption">YOUR SPACE</span>
          <button
            className={page === "workspace" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("workspace")}
          >
            <Icon name="grid" />
            Workspace
            <span className="nav-count">
              {items.filter((i) => !i.archived).length}
            </span>
          </button>
          <button
            className={page === "schema" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("schema")}
          >
            <Icon name="shape" />
            Types & fields
          </button>
          <button
            className={page === "connections" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("connections")}
          >
            <Icon name="connect" />
            Connections
          </button>
          <button
            className={page === "recovery" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("recovery")}
          >
            <Icon name="restore" />
            Export & restore
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-label">
            <span className="status-dot" />
            {session.environment === "local"
              ? "Running locally"
              : "Hosted on Cloudflare"}
          </div>
          <p>
            Your shape. Your pace.
            <br />
            Connected to what matters.
          </p>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api("/auth/logout", "POST", {});
                setSession(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Icon name="logout" />
            Lock workspace
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Your workspace</span>
            <span className="slash">/</span>
            {
              (
                {
                  workspace: "Overview",
                  schema: "Types & fields",
                  connections: "Connections",
                  recovery: "Export & restore",
                } as Record<string, string>
              )[page]
            }
          </div>
          <span className="top-note">
            <span className="status-dot" />A space of your own
          </span>
        </header>
        <main className="content">
          <ErrorMessage message={error} />
          <p className="notice" role="status">
            {notice}
          </p>
          {page === "schema" ? (
            <SchemaSettings schema={schema} reload={() => load()} />
          ) : page === "connections" ? (
            <Connections session={session} />
          ) : page === "recovery" ? (
            <Recovery
              reload={async () => {
                await load(true);
              }}
            />
          ) : (
            <>
              <div className="workspace-heading">
                <div>
                  <span className="eyebrow">ROOM FOR WHAT MATTERS</span>
                  <h1>
                    Your workspace<span className="heading-dot">.</span>
                  </h1>
                  <p>A starting point, not a set of rules. Make it yours.</p>
                </div>
                <button className="primary" onClick={() => setEditor(null)}>
                  <Icon name="plus" />
                  New item
                </button>
              </div>
              <div className="workspace-toolbar">
                <div className="search">
                  <Icon name="search" />
                  <input
                    aria-label="Search items"
                    placeholder="Find something…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter by type"
                  value={prefs.typeId}
                  onChange={(e) =>
                    changePrefs({
                      mode: "list",
                      typeId: e.target.value,
                      fieldId: "",
                    })
                  }
                >
                  <option value="">All types</option>
                  {schema.types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <label className="archive-toggle">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />
                  Archived
                </label>
                <div className="view-switch">
                  <button
                    aria-label="List view"
                    aria-pressed={!board}
                    className={!board ? "chosen" : ""}
                    onClick={() => changePrefs({ ...prefs, mode: "list" })}
                  >
                    <Icon name="list" />
                  </button>
                  <button
                    aria-label="Board view"
                    aria-pressed={board}
                    disabled={!selectFields.length}
                    title={
                      !selectFields.length
                        ? "Choose a type with a select field to use a board."
                        : "Board view"
                    }
                    className={board ? "chosen" : ""}
                    onClick={() =>
                      changePrefs({
                        ...prefs,
                        mode: "board",
                        fieldId: grouping?.id ?? selectFields[0]?.id ?? "",
                      })
                    }
                  >
                    <Icon name="board" />
                  </button>
                </div>
              </div>
              {prefs.mode === "board" && !grouping && (
                <p role="status" className="muted">
                  The board grouping is unavailable. Showing the list; choose a
                  type with an active select field to configure a board.
                </p>
              )}
              {board && (
                <label className="grouping">
                  Group by
                  <select
                    aria-label="Board grouping"
                    value={grouping.id}
                    onChange={(e) =>
                      changePrefs({ ...prefs, fieldId: e.target.value })
                    }
                  >
                    {selectFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!active.length ? (
                <div className="empty-state">
                  <div className="empty-illustration">
                    <div className="paper paper-back" />
                    <div className="paper">
                      <span />
                      <span />
                      <span />
                      <i>+</i>
                    </div>
                    <b className="spark">✳</b>
                  </div>
                  <span className="eyebrow">
                    {query ? "NOTHING HERE YET" : "A CLEAN SLATE"}
                  </span>
                  <h2>
                    {query
                      ? "A little more room to search."
                      : archived
                        ? "Nothing tucked away."
                        : "Everything starts with a little space."}
                  </h2>
                  <p>
                    {query
                      ? "Try another search or a different type."
                      : archived
                        ? "Archived items will be kept here until you need them."
                        : "An idea, a reading list, your next big thing.\nAdd an item and see where it takes you."}
                  </p>
                  {!query && !archived && (
                    <button onClick={() => setEditor(null)}>
                      <Icon name="plus" />
                      Create your first item
                    </button>
                  )}
                  <div className="empty-footnote">
                    Nothing is fixed. Add your own types and fields whenever you
                    need them.
                  </div>
                </div>
              ) : board ? (
                <div className="board">
                  {columns.map((c) => (
                    <section className="board-column" key={c.id}>
                      <h2>
                        <span className="column-dot" />
                        {c.name}
                        <small>
                          {
                            active.filter(
                              (i) => (i.values[grouping.id] ?? "") === c.id,
                            ).length
                          }
                        </small>
                      </h2>
                      {active
                        .filter((i) => (i.values[grouping.id] ?? "") === c.id)
                        .map((i) => (
                          <article className="item-card" key={i.id}>
                            <button
                              className="item-title"
                              onClick={() => setEditor(i)}
                            >
                              {i.title}
                            </button>
                            <p>{i.body.slice(0, 120)}</p>
                            <label className="muted">
                              Move to
                              <select
                                aria-label={"Move " + i.title + " to column"}
                                value={String(i.values[grouping.id] ?? "")}
                                onChange={(e) =>
                                  edit(i, {
                                    values: {
                                      [grouping.id]: e.target.value || null,
                                    },
                                  })
                                }
                              >
                                {columns.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="text-button small"
                              onClick={() => edit(i, { archived: !i.archived })}
                            >
                              {i.archived ? "Restore" : "Archive"}
                            </button>
                          </article>
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="item-table">
                  <div className="table-head">
                    <span>NAME</span>
                    <span>TYPE</span>
                    <span>UPDATED</span>
                    <span />
                  </div>
                  {active.map((i) => (
                    <div className="table-row" key={i.id}>
                      <button
                        className="item-title"
                        onClick={() => setEditor(i)}
                      >
                        <span className="item-symbol">
                          <Icon name="shape" />
                        </span>
                        <div>
                          {i.title}
                          <small>
                            {i.body.slice(0, 100) || "A little room for more."}
                          </small>
                        </div>
                      </button>
                      <span className="pill">
                        {schema.types.find((t) => t.id === i.typeId)?.name}
                      </span>
                      <span className="date">
                        {new Date(i.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={
                          (i.archived ? "Restore " : "Archive ") + i.title
                        }
                        onClick={() => edit(i, { archived: !i.archived })}
                      >
                        <Icon name={i.archived ? "restore" : "archive"} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="collection-footer">
                <span>
                  {active.length} {active.length === 1 ? "item" : "items"}
                  {currentType ? " in " + currentType.name : ""}
                </span>
                <button
                  className="text-button"
                  onClick={() => setPage("schema")}
                >
                  <Icon name="shape" />
                  Shape your workspace
                  <Icon name="arrow" />
                </button>
              </div>
            </>
          )}
        </main>
        <footer className="main-footer">
          <span>Small beginnings. Endless possibilities.</span>
          <span>MALLEABLE / 01</span>
        </footer>
      </div>
      {editor !== undefined && (
        <ItemEditor
          key={editor?.id ?? "new"}
          item={editor}
          types={schema.types}
          fields={schema.fields}
          options={schema.options}
          onClose={() => setEditor(undefined)}
          onSaved={async () => {
            await load();
            setNotice("Saved. A little more space for what matters.");
          }}
          onReload={async (id) => api<Item>("/api/v1/items/" + id)}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

import React, { useEffect, useRef, useState } from "react";
import type { Item, View } from "../domain/model";
import { api, type Schema, type Session } from "./api";
import { Icon } from "./components/Icon";
import { ErrorMessage } from "./components/ErrorMessage";
import { ItemEditor } from "./features/ItemEditor";
import { SchemaSettings } from "./features/SchemaSettings";
import { Connections } from "./features/Connections";
import { Recovery } from "./features/Recovery";
export function App() {
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

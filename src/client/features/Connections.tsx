import React, { useEffect, useState } from "react";
import type { Scope, Token, Subscription, Delivery } from "../../domain/model";
import { api, type Session } from "../api";
import { Dialog } from "../components/Dialog";
import { ErrorMessage } from "../components/ErrorMessage";
export function Connections({ session }: { session: Session }) {
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

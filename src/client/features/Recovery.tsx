import React, { useState } from "react";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { ErrorMessage } from "../components/ErrorMessage";
export function Recovery({ reload }: { reload: () => Promise<void> }) {
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

import React, { useEffect, useState } from "react";
import { ErrorMessage } from "./ErrorMessage";
export function Rename({
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

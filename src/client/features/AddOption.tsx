import React, { useState } from "react";
import type { Field } from "../../domain/model";
import { ErrorMessage } from "../components/ErrorMessage";
export function AddOption({
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

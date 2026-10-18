import type { Type, Field, Option } from "../domain/model";
export type Schema = {
  types: Type[];
  fields: Field[];
  options: Option[];
  revision: number;
};
export type Session = {
  owner: boolean;
  workspace: { id: string; pristine: boolean };
  environment: string;
  apiUrl: string;
};
export class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
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

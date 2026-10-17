import { AppError, requireThat } from "./model";
export function secret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function digest(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function signature(key: string, timestamp: string, body: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return (
    "sha256=" +
    hex(
      await crypto.subtle.sign(
        "HMAC",
        k,
        new TextEncoder().encode(timestamp + "." + body),
      ),
    )
  );
}
export function constantEqual(a: string, b: string) {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export function validOwnerKey(key: string | undefined): key is string {
  return (
    !!key &&
    !/(REPLACE|EXAMPLE|CHANGE_ME|YOUR_)/i.test(key) &&
    /^[A-Za-z0-9_-]{43}$/.test(key) &&
    new Set(key).size >= 12
  );
}
export function localHost(host: string) {
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}
export function checkRequestOrigin(request: Request) {
  const u = new URL(request.url),
    host = request.headers.get("host");
  requireThat(
    !host || host === u.host,
    "invalid_host",
    "Request host does not match its origin.",
    403,
  );
  requireThat(
    u.protocol === "https:" || localHost(u.hostname),
    "https_required",
    "HTTPS is required outside loopback.",
    403,
  );
  const origin = request.headers.get("origin");
  requireThat(
    !origin || origin === u.origin,
    "invalid_origin",
    "Cross-origin requests are not allowed.",
    403,
  );
}
export function allowedHosts(input = "[]"): string[] {
  try {
    const a: unknown = JSON.parse(input);
    return Array.isArray(a) && a.every((h) => typeof h === "string")
      ? a.map((h) => h.toLowerCase())
      : [];
  } catch {
    return [];
  }
}
export function receiverUrl(input: string, hosts: string[], ownOrigin: string) {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new AppError(
      422,
      "invalid_destination",
      "Enter a valid HTTPS receiver URL.",
    );
  }
  const host = u.hostname.toLowerCase();
  requireThat(
    u.protocol === "https:" &&
      (!u.port || u.port === "443") &&
      !u.username &&
      !u.password &&
      !u.hash &&
      u.origin !== ownOrigin &&
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) &&
      host.includes(".") &&
      !/^[\d.]+$/.test(host) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host) &&
      hosts.includes(host),
    "ineligible_destination",
    "Use an allowlisted public HTTPS hostname on port 443, without credentials, fragments, or redirects.",
  );
  return u.href;
}

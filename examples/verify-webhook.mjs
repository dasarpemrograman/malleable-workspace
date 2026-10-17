import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyWebhook({
  secret,
  timestamp,
  signature,
  body,
  now = Math.floor(Date.now() / 1000),
}) {
  if (
    typeof timestamp !== "string" ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300 ||
    typeof signature !== "string" ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(body)
    .digest();
  const received = Buffer.from(signature.slice(7), "hex");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
// After verification, parse the raw JSON and atomically deduplicate
// (event.workspaceId, event.id) with your receiver's side effect in durable storage.

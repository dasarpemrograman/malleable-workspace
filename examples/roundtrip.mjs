const base = (process.env.WORKSPACE_URL ?? "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);
const token = process.env.WORKSPACE_TOKEN;
if (!token)
  throw new Error(
    "Set WORKSPACE_TOKEN privately to a read + item-write token.",
  );
const call = async (path, method = "GET", data) => {
  const r = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error.message);
  return result;
};
const capabilities = await call("/capabilities");
const schema = await call("/schema");
const item = await call("/items", "POST", {
  typeId: schema.types[0].id,
  title: "Connected from an external tool",
  body: "This item was created through the stable API.",
});
const read = await call("/items/" + item.id);
console.log(
  JSON.stringify({
    workspaceId: capabilities.workspaceId,
    itemId: read.id,
    title: read.title,
  }),
);

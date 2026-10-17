import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:8788";
test("owner can shape, connect, and recover a workspace at desktop and narrow widths", async ({
  page,
  context,
}) => {
  const key = (await readFile(".dev.vars", "utf8"))
    .match(/^OWNER_KEY=(.+)$/m)![1]
    .trim();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make yourself at home." }),
  ).toBeVisible();
  await page.getByLabel("Owner key", { exact: true }).fill(key);
  await page
    .getByRole("button", { name: "Open workspace", exact: true })
    .click();
  await expect(
    page.getByText("Everything starts with a little space."),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-empty.png",
    fullPage: true,
  });
  // Exercise recovery before creating data or preferences, while the target is pristine.
  const time = new Date().toISOString();
  const restoredTypeId = crypto.randomUUID();
  const startingSnapshot = {
    version: 1,
    workspace: { id: crypto.randomUUID(), schemaRevision: 1 },
    types: [
      {
        id: restoredTypeId,
        revision: 1,
        createdAt: time,
        updatedAt: time,
        name: "Item",
      },
    ],
    fields: [],
    options: [],
    items: [],
    views: [],
  };
  await page
    .getByRole("button", { name: "Export & restore", exact: true })
    .click();
  await page.getByLabel("Choose JSON snapshot").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(startingSnapshot)),
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Restore snapshot", exact: true })
    .click();
  await expect(
    page.getByText(
      "Workspace restored. Configure new connections when you are ready.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Workspace/ }).click();

  await page
    .getByRole("button", { name: "Types & fields", exact: true })
    .click();
  await page.getByLabel("New type name").fill("Research");
  await page.getByRole("button", { name: "Add type", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fields · Research" }),
  ).toBeVisible();
  await page.getByLabel("New field name").fill("Confidence");
  await page.getByLabel("Field kind", { exact: true }).selectOption("select");
  await page.getByRole("button", { name: "Add field", exact: true }).click();
  await page.getByLabel("New option for Confidence").fill("Low");
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await expect(page.getByLabel("Option name Low")).toBeVisible();
  await page.getByLabel("New option for Confidence").fill("High");
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await expect(page.getByLabel("Option name High")).toBeVisible();
  await page.getByRole("button", { name: /^Workspace/ }).click();
  await page.getByRole("button", { name: "New item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Type", { exact: true })
    .selectOption({ label: "Research" });
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("The next useful idea");
  await dialog
    .getByLabel("Notes", { exact: true })
    .fill("A question worth coming back to.");
  await dialog
    .getByLabel("Confidence", { exact: true })
    .selectOption({ label: "Low" });
  await dialog.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /^The next useful idea/ }),
  ).toBeVisible();
  const req = async (path: string, method = "GET", data?: unknown) => {
    const r = await context.request.fetch(origin + path, {
      method,
      headers: { Origin: origin },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  const schema = await req("/api/v1/schema");
  const type = schema.types.find((t: any) => t.name === "Research"),
    field = schema.fields.find((f: any) => f.name === "Confidence"),
    low = schema.options.find((o: any) => o.name === "Low");
  const token = await req("/owner/tokens", "POST", {
    name: "Browser acceptance tool",
    scopes: ["workspace:read", "items:write", "schema:write"],
  });
  const call = async (path: string, method = "GET", data?: unknown) => {
    const r = await context.request.fetch(origin + path, {
      method,
      headers: { Authorization: "Bearer " + token.secret },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  let item = (await call("/api/v1/items")).items[0];
  await page.getByLabel("Filter by type").selectOption(type.id);
  await page.getByRole("button", { name: "Board view", exact: true }).click();
  await expect(page.getByLabel("Board grouping")).toBeVisible();
  await page
    .getByLabel("Move The next useful idea to column")
    .selectOption({ label: "High" });
  await expect
    .poll(async () => (await call("/api/v1/items/" + item.id)).values[field.id])
    .toBe(schema.options.find((o: any) => o.name === "High").id);
  await call("/api/v1/types/" + type.id, "PATCH", {
    revision: type.revision,
    name: "Questions",
  });
  await call("/api/v1/fields/" + field.id, "PATCH", {
    revision: field.revision,
    name: "Certainty",
  });
  await call("/api/v1/options/" + low.id, "PATCH", {
    revision: low.revision,
    name: "Open",
  });
  item = await call("/api/v1/items/" + item.id);
  await call("/api/v1/items/" + item.id, "PATCH", {
    revision: item.revision,
    title: "An external update",
    values: { [field.id]: low.id },
  });
  await expect(
    page.getByRole("button", { name: "An external update", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("Board grouping")).toContainText("Certainty");
  await expect(page.getByRole("heading", { name: /Open/ })).toBeVisible();
  await page
    .getByRole("button", { name: "An external update", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("My unsaved draft");
  item = await call("/api/v1/items/" + item.id);
  await call("/api/v1/items/" + item.id, "PATCH", {
    revision: item.revision,
    title: "A newer external update",
  });
  await page.waitForTimeout(5200);
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true }),
  ).toHaveValue("My unsaved draft");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save item" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Reload");
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true }),
  ).toHaveValue("My unsaved draft");
  await page.getByRole("button", { name: "Close dialog" }).click();
  const activeField = (await call("/api/v1/schema")).fields.find(
    (f: any) => f.id === field.id,
  );
  await call("/api/v1/fields/" + field.id, "PATCH", {
    revision: activeField.revision,
    archived: true,
  });
  await expect(page.getByText(/board grouping is unavailable/)).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByRole("button", { name: /^A newer external update/ }),
  ).toBeVisible();
  // Restore the grouping and verify a board exhausts all API pages.
  const archivedField = (await call("/api/v1/schema")).fields.find(
    (f: any) => f.id === field.id,
  );
  await call("/api/v1/fields/" + field.id, "PATCH", {
    revision: archivedField.revision,
    archived: false,
  });
  for (let i = 0; i < 101; i++)
    await call("/api/v1/items", "POST", {
      typeId: type.id,
      title: "Paged " + String(i).padStart(3, "0"),
    });
  await expect(page.locator(".item-card")).toHaveCount(102, { timeout: 15000 });
  await page.getByLabel("Search items").fill("no matching idea");
  await expect(page.getByText("A little more room to search.")).toBeVisible();
  await page.getByLabel("Search items").fill("");
  await page.screenshot({
    path: "test-results/workspace-board.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(page.getByText("LOCAL API", { exact: false })).toBeVisible();
  await page
    .getByLabel("Token name", { exact: true })
    .fill("Read-only assistant");
  await page.getByRole("button", { name: "Create token", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Your new API token" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I saved it", exact: true }).click();
  let axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({
    path: "test-results/connections-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: /^Workspace/ }).click();
  await page.getByRole("button", { name: "New item", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("dialog") !== null,
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Export & restore", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Download snapshot/ }),
  ).toBeVisible();
  const snapshot = await req("/owner/export");
  expect(snapshot.items.some((i: any) => i.id === item.id)).toBeTruthy();
  expect(snapshot.tokens).toBeUndefined();
});

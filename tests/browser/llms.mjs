import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect, request } from "@playwright/test";

const base = process.env.QUIXSEO_TEST_URL || "http://127.0.0.1:4321";
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
const output = "test-results/llms";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext();
const anonymous = await request.newContext();
const page = await context.newPage();
page.setDefaultTimeout(20000);
const diagnostics = [];
page.on("pageerror", (error) => diagnostics.push(error.message));
const checks = [];
let original;
let failure;
const labels = {
  enabled: "Enable public llms.txt generation",
  summary: "Public site summary (optional)",
  collections:
    "Collections to include, comma separated (empty = all visible SEO-enabled collections)",
};
const field = (key) => page.getByLabel(labels[key], { exact: true });
async function settings() {
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/settings`);
  await field("summary").waitFor();
}
async function save(config) {
  await field("enabled").setChecked(config.enabled);
  await field("summary").fill(config.summary);
  await field("collections").fill(config.collections);
  await page
    .getByRole("button", { name: "Save llms.txt settings", exact: true })
    .click();
  await page.getByText("llms.txt settings saved", { exact: true }).waitFor();
}
try {
  const robotsBefore = await (await anonymous.get(`${base}/robots.txt`)).text();
  await page.goto(
    `${base}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`,
  );
  await page.waitForURL("**/admin");
  await settings();
  original = {
    enabled: await field("enabled").isChecked(),
    summary: await field("summary").inputValue(),
    collections: await field("collections").inputValue(),
  };
  const config = {
    enabled: true,
    summary: 'QA llms guide <safe> & "quotes"',
    collections: "",
  };
  await save(config);
  await settings();
  await expect(field("summary")).toHaveValue(config.summary);
  await expect(field("enabled")).toBeChecked();
  checks.push("Admin settings persist across reloads");
  await page
    .getByRole("button", { name: "Preview llms.txt", exact: true })
    .click();
  await page.getByText("llms.txt preview", { exact: true }).waitFor();
  await expect(page.locator("pre")).toContainText("QA llms guide &lt;safe&gt;");
  await page.screenshot({ path: `${output}/preview.png`, fullPage: true });
  checks.push("Preview shows escaped Markdown in native Block Kit");
  const endpoint = `${base}/_emdash/api/plugins/quixseo/llms-txt`;
  const direct = await anonymous.get(endpoint);
  const root = await anonymous.get(`${base}/llms.txt`, { maxRedirects: 0 });
  assert.equal(direct.status(), 200);
  assert.equal(root.status(), 200);
  assert.equal(root.headers()["content-type"], "text/plain; charset=utf-8");
  assert.equal(root.headers()["cache-control"], "no-store");
  assert.equal(await root.text(), await direct.text());
  assert.match(await root.text(), /QA llms guide &lt;safe&gt;/);
  assert.equal((await anonymous.head(`${base}/llms.txt`)).status(), 200);
  const download = await anonymous.get(`${base}/llms.txt?download=1`);
  assert.equal(download.status(), 200);
  assert.equal(
    download.headers()["content-disposition"],
    'attachment; filename="llms.txt"',
  );
  checks.push(
    "Anonymous root rewrite serves raw text, HEAD and downloads without redirects",
  );
  await settings();
  await save({ ...config, enabled: false });
  assert.equal((await anonymous.get(endpoint)).status(), 404);
  assert.equal((await anonymous.get(`${base}/llms.txt`)).status(), 404);
  assert.equal(
    await (await anonymous.get(`${base}/robots.txt`)).text(),
    robotsBefore,
  );
  checks.push("Disabling removes live output and leaves robots.txt unchanged");
  assert.deepEqual(diagnostics, []);
} catch (error) {
  failure = error;
  await page
    .screenshot({ path: `${output}/failure.png`, fullPage: true })
    .catch(() => {});
} finally {
  try {
    if (original) {
      await settings();
      await save(original);
    }
  } catch (error) {
    failure ||= error;
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks, diagnostics, error: failure?.stack }, null, 2),
  );
  await anonymous.dispose();
  await browser.close();
}
if (failure) throw failure;
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

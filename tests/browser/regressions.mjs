import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.env.QUIXSEO_TEST_URL || "http://127.0.0.1:4321";
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
const output = process.env.QUIXSEO_QA_DIR || "test-results/regressions";
await mkdir(output, { recursive: true });
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const executablePath =
  process.env.CHROMIUM_PATH || (existsSync(edge) ? edge : undefined);
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
context.setDefaultTimeout(15000);
const page = await context.newPage();
const publicPage = await context.newPage();
const checks = [];
const diagnostics = [];
const failedResponses = [];
page.on("response", (r) => {
  if (r.status() >= 400)
    failedResponses.push({ url: r.url(), status: r.status() });
});
page.on("pageerror", (e) =>
  diagnostics.push({ type: "pageerror", message: e.message }),
);
page.on("console", (m) => {
  if (m.type() === "error")
    diagnostics.push({
      type: "console",
      message: m.text(),
      location: m.location(),
    });
});
let item;
let failure;
let cleanup;
const title = `QA TEMP regression checkout ${Date.now()}`;
const nativeSeo = {
  title: `${title} SEO`,
  description: "QA native description",
  noIndex: false,
};
async function api(path, method = "GET", data) {
  const r = await context.request.fetch(`${base}/_emdash/api/${path}`, {
    method,
    data,
    headers: { "X-EmDash-Request": "1", Origin: base },
  });
  const j = await r.json();
  assert(
    r.ok() && j.success,
    JSON.stringify({ path, status: r.status(), body: j }),
  );
  return j.data;
}
async function panel(p = page) {
  await p.goto(`${base}/_emdash/admin/content/posts/${item.id}`);
  await p
    .getByRole("button", { name: "QuixSEO · Content guidance", exact: true })
    .click();
  await p
    .getByLabel("Focus keyphrases, comma separated", { exact: true })
    .waitFor();
}
async function save() {
  await page
    .getByRole("button", { name: "Save QuixSEO settings", exact: true })
    .click();
  await page.getByText(/QuixSEO settings saved/).waitFor();
}
async function confirm(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}
async function bulk(proposal) {
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/bulk`);
  await page
    .getByLabel("Changes as JSON array (up to 20 entries)", { exact: true })
    .fill(JSON.stringify([proposal]));
  await page
    .getByRole("button", { name: "Prepare change preview", exact: true })
    .click();
  await page.getByText("Review changes", { exact: true }).waitFor();
}
try {
  await page.goto(
    `${base}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`,
  );
  await page.waitForURL("**/admin");
  item = (
    await api("content/posts", "POST", {
      slug: `qa-regression-${Date.now()}`,
      seo: nativeSeo,
      data: {
        title,
        excerpt: "Temporary regression fixture",
        content: [
          {
            _type: "block",
            _key: "body",
            style: "normal",
            markDefs: [],
            children: [
              {
                _type: "span",
                _key: "s",
                text: "Checkout guidance for the temporary QA fixture.",
                marks: [],
              },
            ],
          },
        ],
      },
    })
  ).item;
  await writeFile(join(output, "fixture.json"), JSON.stringify(item, null, 2));
  await panel();
  assert.equal(await page.locator("form form").count(), 0);
  checks.push("EmDash 1.4 editor renders no nested forms");
  await page
    .getByLabel("Focus keyphrases, comma separated", { exact: true })
    .fill("checkout guidance");
  await page
    .getByLabel("Open Graph title override", { exact: true })
    .fill('QA social & "quotes" <safe>');
  await page.getByLabel("Nofollow links on this page", { exact: true }).check();
  await page
    .getByLabel(
      "Advanced schema configuration (JSON; leave empty for WebPage defaults)",
      { exact: true },
    )
    .fill(JSON.stringify({ type: "BlogPosting", author: "QA author" }));
  await save();
  await panel();
  await expect(
    page.getByLabel("Focus keyphrases, comma separated", { exact: true }),
  ).toHaveValue("checkout guidance");
  checks.push("One-click editor save persists settings");
  const before = (await api(`content/posts/${item.id}`)).item;
  await bulk({
    collection: "posts",
    id: item.id,
    config: { cornerstone: true },
  });
  await expect(
    page.getByText(`${title} · Pending · 1 change`, { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(output, "bulk-one-change.png"),
    fullPage: true,
  });
  await confirm("Apply changes");
  await page
    .getByRole("button", { name: "Revert change", exact: true })
    .waitFor();
  await panel();
  await expect(
    page.getByLabel("Focus keyphrases, comma separated", { exact: true }),
  ).toHaveValue("checkout guidance");
  await expect(
    page.getByLabel("Open Graph title override", { exact: true }),
  ).toHaveValue('QA social & "quotes" <safe>');
  await expect(
    page.getByLabel("Nofollow links on this page", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Cornerstone content", { exact: true }),
  ).toBeChecked();
  assert.equal(
    JSON.parse(
      await page
        .getByLabel(
          "Advanced schema configuration (JSON; leave empty for WebPage defaults)",
          { exact: true },
        )
        .inputValue(),
    ).author,
    "QA author",
  );
  const after = (await api(`content/posts/${item.id}`)).item;
  assert.deepEqual(after.seo, before.seo);
  assert.equal(after.status, before.status);
  checks.push(
    "Sparse bulk preview/apply preserves unrelated plugin/native values and status",
  );
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/history`);
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .filter({ hasText: "bulk" })
    .first()
    .getByRole("button", { name: "View change", exact: true })
    .click();
  await confirm("Revert change");
  await page.getByText("Change reverted", { exact: true }).waitFor();
  await panel();
  await expect(
    page.getByLabel("Cornerstone content", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Open Graph title override", { exact: true }),
  ).toHaveValue('QA social & "quotes" <safe>');
  checks.push("Bulk rollback restores only the intended change");
  const stale = await context.newPage();
  await panel(stale);
  await page
    .getByLabel("Focus keyphrases, comma separated", { exact: true })
    .fill("checkout latest");
  await save();
  await stale
    .getByLabel("Focus keyphrases, comma separated", { exact: true })
    .fill("stale checkout");
  await stale
    .getByRole("button", { name: "Save QuixSEO settings", exact: true })
    .click();
  await stale
    .getByText(/QuixSEO settings changed since this form opened/)
    .waitFor();
  await expect(
    stale.getByLabel("Focus keyphrases, comma separated", { exact: true }),
  ).toHaveValue("stale checkout");
  await stale.close();
  await panel();
  await expect(
    page.getByLabel("Focus keyphrases, comma separated", { exact: true }),
  ).toHaveValue("checkout latest");
  checks.push(
    "Stale editor submissions retain edits without overwriting newer settings",
  );
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/redirects`);
  await page
    .getByLabel("Source local path", { exact: true })
    .fill("/qa-regression-invalid");
  await page
    .getByLabel("Destination local path or absolute URL", { exact: true })
    .fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Validate redirect", exact: true })
    .click();
  await page.getByText("Review your submission", { exact: true }).waitFor();
  await expect(
    page.getByLabel("Source local path", { exact: true }),
  ).toHaveValue("/qa-regression-invalid");
  await expect(
    page.getByLabel("Destination local path or absolute URL", { exact: true }),
  ).toHaveValue("javascript:alert(1)");
  await page.screenshot({
    path: join(output, "redirect-retained.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Destination local path or absolute URL", { exact: true })
    .fill("/");
  await page
    .getByRole("button", { name: "Validate redirect", exact: true })
    .click();
  await page.getByText("Review redirect", { exact: true }).waitFor();
  checks.push(
    "Redirect validation retains inputs and correction works without reload or writes",
  );
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/migration`);
  const invalid = JSON.stringify([
    { source: "other", collection: "posts", id: item.id, meta: {} },
  ]);
  await page
    .getByLabel("Mapped Yoast or Rank Math records (up to 20)", { exact: true })
    .fill(invalid);
  await page
    .getByRole("button", { name: "Preview mapped import", exact: true })
    .click();
  await page.getByText("Review your submission", { exact: true }).waitFor();
  await expect(
    page.getByLabel("Mapped Yoast or Rank Math records (up to 20)", {
      exact: true,
    }),
  ).toHaveValue(invalid);
  await expect(
    page.getByText("0.source: Choose yoast or rankmath.", { exact: true }),
  ).toBeVisible();
  checks.push(
    "Migration validation retains mapped JSON with a readable source error",
  );
  await bulk({
    collection: "posts",
    id: item.id,
    seo: { title: "Blocked native change" },
    config: { cornerstone: true },
  });
  await expect(
    page.getByText("Native SEO changes require EmDash", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page
      .getByRole("button", { name: "Apply changes", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(
    (await api(`content/posts/${item.id}`)).item.seo,
    before.seo,
  );
  checks.push("Native SEO mixed plans remain blocked without partial writes");
  await api(`content/posts/${item.id}/publish`, "POST", {});
  assert.equal(
    (await publicPage.goto(`${base}/posts/${item.slug}`)).status(),
    200,
  );
  for (const selector of [
    "title",
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[property="og:title"]',
    'script[type="application/ld+json"]',
  ])
    assert.equal(await publicPage.locator(selector).count(), 1, selector);
  assert.equal(
    await publicPage
      .locator('meta[property="og:title"]')
      .getAttribute("content"),
    'QA social & "quotes" <safe>',
  );
  checks.push(
    "Published QA output remains deduplicated and escapes social overrides",
  );
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/dashboard`);
  await page
    .getByRole("button", { name: "Start a new site review", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Cancel audit", exact: true })
      .count(),
    0,
    "An existing audit is active; leave it untouched",
  );
  await page
    .getByRole("button", { name: "Start a new site review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start a new site review", exact: true })
    .waitFor({ state: "hidden" });
  await page.getByText("Completed", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "View audit results", exact: true })
    .click();
  await page.getByRole("row").filter({ hasText: title }).waitFor();
  await page.screenshot({
    path: join(output, "audit-1.4.png"),
    fullPage: true,
  });
  checks.push(
    "Automatic audit completes without processing clicks and includes the published QA entry",
  );
  assert.deepEqual(diagnostics, []);
  checks.push("Regression workflows emit no page or console errors");
} catch (error) {
  failure = error;
  await page
    .screenshot({ path: join(output, "failure.png"), fullPage: true })
    .catch(() => {});
} finally {
  try {
    if (item) {
      if ((await api(`content/posts/${item.id}`)).item.status === "published")
        await api(`content/posts/${item.id}/unpublish`, "POST", {});
      await panel();
      for (const label of [
        "Focus keyphrases, comma separated",
        "Open Graph title override",
        "Advanced schema configuration (JSON; leave empty for WebPage defaults)",
      ])
        await page.getByLabel(label, { exact: true }).fill("");
      await page
        .getByLabel("Nofollow links on this page", { exact: true })
        .uncheck();
      await page.getByLabel("Cornerstone content", { exact: true }).uncheck();
      await save();
      cleanup = {
        id: item.id,
        slug: item.slug,
        status: (await api(`content/posts/${item.id}`)).item.status,
      };
      assert.equal(cleanup.status, "draft");
    }
  } catch (error) {
    failure ||= error;
  }
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        checks,
        diagnostics,
        failedResponses,
        cleanup,
        error: failure?.stack,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (failure) throw failure;
console.log(
  JSON.stringify({ passed: checks.length, checks, cleanup }, null, 2),
);

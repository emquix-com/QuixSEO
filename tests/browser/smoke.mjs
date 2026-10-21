import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const base = process.env.QUIXSEO_TEST_URL || "http://127.0.0.1:4321";
assert(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname),
  "This mutating fixture test is local-only",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const publicPage = await browser.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
const results = [];
await mkdir("test-results", { recursive: true });
await mkdir("screenshots", { recursive: true });
await mkdir("docs/screenshots", { recursive: true });
async function api(path, method = "GET", data) {
  const r = await page.request.fetch(`${base}/_emdash/api/${path}`, {
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
async function pluginPage(path) {
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/${path}`);
}
async function confirm(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}
try {
  await page.goto(
    `${base}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`,
  );
  await page
    .getByText("QuixSEO", { exact: true })
    .first()
    .waitFor({ timeout: 60000 });
  const welcome = page.getByRole("button", {
    name: "Get Started",
    exact: true,
  });
  await welcome
    .waitFor({ timeout: 2000 })
    .then(() => welcome.click())
    .catch(() => {});
  results.push("Installed plugin appears in native admin");
  await pluginPage("settings");
  await page
    .getByLabel("Public name", { exact: true })
    .fill("QuixSEO Test Garden");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.getByText("QuixSEO settings saved", { exact: true }).waitFor();
  await page.screenshot({ path: "docs/screenshots/settings.jpg", quality: 45 });
  results.push("Saved identity through Block Kit settings form");
  await api("schema/collections/posts", "PUT", {
    supports: ["drafts", "revisions", "search", "seo"],
    urlPattern: "/posts/{slug}",
  });
  let item = (await api("content/posts")).items.find(
    (x) => x.slug === "quixseo-garden",
  );
  const seo = {
    title: "Garden care | QuixSEO",
    description: "Learn simple, practical garden care.",
    canonical: `${base}/posts/quixseo-garden`,
    noIndex: false,
  };
  if (!item)
    item = (
      await api("content/posts", "POST", {
        slug: "quixseo-garden",
        data: {
          title: "Garden care",
          excerpt: "Practical garden care tips.",
          content: [
            {
              _type: "block",
              _key: "body1",
              style: "normal",
              children: [
                {
                  _type: "span",
                  _key: "span1",
                  text: "Garden care starts with soil. Water gently because roots need oxygen. Read our home page.",
                  marks: ["home"],
                },
              ],
              markDefs: [{ _type: "link", _key: "home", href: "/" }],
            },
          ],
        },
        seo,
      })
    ).item;
  else await api(`content/posts/${item.id}`, "PUT", { seo });
  await api(`content/posts/${item.id}/publish`, "POST", {});
  results.push(
    "Created/updated native SEO and published actual content through core API",
  );
  const response = await publicPage.goto(`${base}/posts/quixseo-garden`);
  assert.equal(response.status(), 200);
  assert.equal(await publicPage.title(), seo.title);
  const beforeSocial = await publicPage
    .locator('meta[property="og:title"]')
    .getAttribute("content");
  for (const selector of [
    'link[rel="canonical"]',
    'meta[name="description"]',
    'meta[property="og:title"]',
    'script[type="application/ld+json"]',
  ])
    assert.equal(await publicPage.locator(selector).count(), 1, selector);
  assert.equal(
    await publicPage.locator('link[rel="canonical"]').getAttribute("href"),
    seo.canonical,
  );
  results.push(
    "Anonymous public page renders native title, description and a single canonical/social/schema set",
  );
  await page.goto(`${base}/_emdash/admin/content/posts/${item.id}`);
  const panel = page.getByRole("button", {
    name: "QuixSEO · Content guidance",
    exact: true,
  });
  await panel.waitFor();
  await panel.click();
  await page.getByText("SEO checklist", { exact: true }).waitFor();
  await page
    .getByText("SEO checklist", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/editor.jpg", quality: 45 });
  const social = `Garden social ${Date.now()}`;
  await page
    .getByLabel("Focus keyphrases, comma separated", { exact: true })
    .fill("garden care");
  await page.getByLabel("Open Graph title", { exact: true }).fill(social);
  await page
    .getByLabel(
      "Advanced schema configuration (JSON; leave empty for WebPage defaults)",
      { exact: true },
    )
    .fill(JSON.stringify({ type: "BlogPosting", author: "Test author" }));
  await page
    .getByRole("button", { name: "Preview SEO changes", exact: true })
    .click();
  await confirm("Confirm and apply next entry");
  await expect(page.getByText("applied", { exact: true })).toBeVisible();
  await publicPage.reload();
  assert.equal(
    await publicPage
      .locator('meta[property="og:title"]')
      .getAttribute("content"),
    social,
  );
  const graph = JSON.parse(
    await publicPage
      .locator('script[type="application/ld+json"]')
      .textContent(),
  );
  assert(graph["@graph"].some((x) => x["@type"] === "BlogPosting"));
  assert(!JSON.stringify(graph).includes("##"));
  results.push(
    "Editor preview/confirmation persists plugin data; anonymous HTML reflects social and BlogPosting overrides",
  );
  await confirm("Revert next unchanged result");
  await expect(page.getByText("rolled-back", { exact: true })).toBeVisible();
  await publicPage.reload();
  assert.equal(
    await publicPage
      .locator('meta[property="og:title"]')
      .getAttribute("content"),
    beforeSocial,
  );
  results.push("Editor rollback restores previous public social metadata");
  await pluginPage("dashboard");
  await page
    .getByRole("button", { name: "Start a new site review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Analyze next entry", exact: true })
    .waitFor();
  for (let step = 0; step < 10; step++) {
    const next = page.getByRole("button", {
      name: "Analyze next entry",
      exact: true,
    });
    if (!(await next.isVisible())) break;
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/plugins/quixseo/admin") &&
          r.request().method() === "POST",
      ),
      next.click(),
    ]);
    await page.waitForTimeout(100);
  }
  await expect(
    page.getByText("Site checklist average", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "screenshots/dashboard.jpg", quality: 45 });
  results.push(
    "Real audit advances through scan/assessment and displays completed statistics",
  );
  for (const [path, text] of [
    ["bulk", "Bulk SEO editor"],
    ["migration", "Migrate WordPress SEO metadata"],
    ["redirects", "Validate redirect"],
    ["history", "View / resume"],
  ]) {
    await pluginPage(path);
    await page.getByText(text, { exact: true }).first().waitFor();
    assert(
      !(await page.locator("body").innerText()).includes("could not complete"),
    );
  }
  results.push(
    "Bulk, migration, redirects and history screens load in the native admin",
  );
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({ passed: results.length, checks: results }, null, 2),
  );
  await writeFile(
    "test-results/browser.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        passed: results.length,
        checks: results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/browser-failure.png",
    fullPage: true,
  });
  console.error("BODY", (await page.locator("body").innerText()).slice(-5000));
  throw error;
} finally {
  await browser.close();
}

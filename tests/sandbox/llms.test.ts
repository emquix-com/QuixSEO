import {
  createPluginRuntimeTestHost,
  type PluginRuntimeTestHost,
} from "@emdash-cms/plugin-test";
import { afterEach, expect, it } from "vitest";

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => {
  await host?.dispose();
  host = undefined;
});
async function setup(url = "https://example.com") {
  host = await createPluginRuntimeTestHost({
    site: { name: "Public garden", url, locale: "en" },
  });
  await host.fixtures.collection({
    slug: "posts",
    label: "Posts",
    supports: ["seo", "drafts", "revisions"],
    urlPattern: "/posts/{slug}",
    fields: [
      { slug: "title", label: "Title", type: "string", translatable: true },
      { slug: "body", label: "Body", type: "text", translatable: true },
    ],
  });
  const user = await host.fixtures.user({
    email: "admin@example.test",
    role: "admin",
  });
  const item = await host.fixtures.content("posts", {
    data: {
      title: "Published plants",
      body: "Published body is also not exported",
    },
    slug: "plants",
    status: "published",
  });
  return { host, user, item };
}
const saveInput = {
  enabled: true,
  summary: "Guidance about plants.",
  collections: "posts",
};
it("serves opt-in raw text, downloads and HEAD through the real sandbox boundary", async () => {
  const { host, user } = await setup();
  expect(
    (await host.actions.routes.request("llms-txt", { method: "GET" })).status,
  ).toBe(404);
  const saved = await host.admin.submit("/settings", "save-llms", saveInput, {
    user,
  });
  expect(JSON.stringify(saved)).toContain("llms.txt settings saved");
  const response = await host.actions.routes.request("llms-txt", {
    method: "GET",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe(
    "text/plain; charset=utf-8",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  const text = await response.text();
  expect(text).toContain("# Public garden");
  expect(text).toContain(
    "[Published plants](https://example.com/posts/plants)",
  );
  expect(text).not.toContain("Published body");
  expect(text).not.toContain('"success":true');
  const head = await host.actions.routes.request("llms-txt", {
    method: "HEAD",
  });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
  const download = await host.actions.routes.request("llms-txt", {
    method: "GET",
    url: "https://example.com/_emdash/api/plugins/quixseo/llms-txt?download=1",
  });
  expect(download.status).toBe(200);
  expect(download.headers.get("content-disposition")).toBe(
    'attachment; filename="llms.txt"',
  );
  expect(
    (await host.actions.routes.request("llms-txt", { method: "POST" })).status,
  ).toBe(405);
  expect(
    (
      await host.actions.routes.request("llms-txt", {
        method: "GET",
        url: "https://example.com/_emdash/api/plugins/quixseo/llms-txt?collection=private",
      })
    ).status,
  ).toBe(400);
});
it("never exports saved unpublished revisions, drafts, noindex or noncanonical entries", async () => {
  const { host, item } = await setup();
  await host.fixtures.plugin.storage("settings", "llms", { enabled: true });
  await host.fixtures.content("posts", {
    data: { title: "Private draft secret", body: "Confidential" },
    slug: "private",
    status: "draft",
  });
  const hidden = await host.fixtures.content("posts", {
    data: { title: "Noindex secret" },
    slug: "noindex",
    status: "published",
  });
  const canonical = await host.fixtures.content("posts", {
    data: { title: "Syndicated duplicate" },
    slug: "duplicate",
    status: "published",
  });
  expect(
    (
      await host.actions.content.update("posts", hidden.id, {
        seo: { noIndex: true },
      })
    ).success,
  ).toBe(true);
  expect(
    (
      await host.actions.content.update("posts", canonical.id, {
        seo: { canonical: "https://other.test/original" },
      })
    ).success,
  ).toBe(true);
  expect(
    (
      await host.actions.content.update("posts", item.id, {
        data: { title: "Unpublished new title", body: "Confidential new body" },
      })
    ).success,
  ).toBe(true);
  const response = await host.actions.routes.request("llms-txt", {
    method: "GET",
  });
  const text = await response.text();
  expect(response.status).toBe(200);
  expect(text).toContain("Published plants");
  for (const absent of [
    "Private draft",
    "Noindex secret",
    "Syndicated duplicate",
    "Unpublished",
    "Confidential",
  ])
    expect(text).not.toContain(absent);
});
it("reflects noindex, unpublishing and disabling without using stored audit snapshots", async () => {
  const { host, user, item } = await setup();
  await host.admin.submit("/settings", "save-llms", saveInput, { user });
  const get = () => host.actions.routes.request("llms-txt", { method: "GET" });
  expect(await (await get()).text()).toContain("Published plants");
  await host.actions.content.update("posts", item.id, {
    seo: { noIndex: true },
  });
  expect(await (await get()).text()).not.toContain("Published plants");
  await host.actions.content.update("posts", item.id, {
    seo: { noIndex: false },
  });
  expect(await (await get()).text()).toContain("Published plants");
  await host.actions.content.update("posts", item.id, { status: "draft" });
  expect(await (await get()).text()).not.toContain("Published plants");
  await host.admin.submit(
    "/settings",
    "save-llms",
    { ...saveInput, enabled: false },
    { user },
  );
  expect((await get()).status).toBe(404);
});
it("requires admin configuration, preserves SEO settings and validates malformed site context", async () => {
  const { host, user } = await setup("");
  const editor = await host.fixtures.user({
    email: "editor@example.test",
    role: "editor",
  });
  const denied = await host.admin.submit("/settings", "save-llms", saveInput, {
    user: editor,
  });
  expect(JSON.stringify(denied)).toContain("Permission denied");
  expect(await host.inspect.storage.get("settings", "llms")).toBeNull();
  const invalid = await host.admin.submit("/settings", "save-llms", saveInput, {
    user,
  });
  expect(JSON.stringify(invalid)).toContain("Configure your Site URL");
  expect(await host.inspect.storage.get("settings", "llms")).toBeNull();
  await host.fixtures.plugin.storage("settings", "llms", { enabled: true });
  expect(
    (await host.actions.routes.request("llms-txt", { method: "GET" })).status,
  ).toBe(503);
  await host.fixtures.site({ url: "https://example.com" });
  await host.fixtures.plugin.storage("settings", "site", {
    defaultDescription: "Keep this",
    metadata: false,
  });
  await host.admin.submit("/settings", "save-llms", saveInput, { user });
  expect(await host.inspect.storage.get("settings", "site")).toEqual({
    defaultDescription: "Keep this",
    metadata: false,
  });
  expect(
    (await host.actions.routes.request("llms-txt", { method: "GET" })).status,
  ).toBe(200);
});

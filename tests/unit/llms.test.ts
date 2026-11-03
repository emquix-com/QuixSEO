import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import { describe, expect, it, vi } from "vitest";
import {
  LLMS_BYTE_LIMIT,
  LLMS_ENTRY_LIMIT,
  llmsConfigSchema,
  renderLlms,
} from "../../src/domain/llms.js";
import { generateLlms, llmsRoute, llmsUrls } from "../../src/services/llms.js";
import { admin } from "../../src/ui/admin.js";
import { llmsBlocks, llmsPreview } from "../../src/ui/llms.js";

function fixture(count = 3) {
  const items = Array.from({ length: count }, (_, n) => ({
    id: String(n),
    status: "published",
    slug: `page-${n}`,
    data: {
      title: `Page ${n}`,
      body: "Secret body never exported",
      excerpt: "Not exported either",
    },
    seo: { noIndex: false, canonical: "" },
  }));
  const config = new Map<string, unknown>();
  const collections = [
    {
      slug: "posts",
      label: "Posts",
      hasSeo: true,
      routable: true,
      hidden: false,
      titleField: "title",
    },
  ];
  const list = vi.fn(
    async (
      _collection: string,
      options: { cursor?: string; limit: number; where: { status: string } },
    ) => {
      expect(options.where.status).toBe("published");
      const offset = Number(options.cursor ?? 0),
        end = offset + options.limit;
      return {
        items: items.slice(offset, end),
        hasMore: end < items.length,
        cursor: end < items.length ? String(end) : undefined,
      };
    },
  );
  const getPublicUrl = vi.fn(
    async (_c: string, id: string) => `https://example.com/posts/${id}`,
  );
  const ctx = {
    site: { name: "Example", url: "https://example.com", locale: "en" },
    content: { list, getPublicUrl },
    schema: { listCollections: async () => collections },
    storage: {
      settings: {
        get: async (key: string) => config.get(key) ?? null,
        put: async (key: string, value: unknown) => {
          config.set(key, value);
        },
      },
    },
    log: { error: vi.fn() },
  } as unknown as PluginContext;
  const route = (input: unknown = {}) =>
    ({ input, request: { method: "GET" } }) as SandboxedRouteContext;
  return { ctx, items, collections, config, route, list, getPublicUrl };
}
const enabled = llmsConfigSchema.parse({
  enabled: true,
  summary: "Public guidance.",
});
describe("llms.txt generation", () => {
  it("is opt-in and does no content reads when disabled", async () => {
    const f = fixture();
    expect((await llmsRoute(f.route(), f.ctx)).status).toBe(404);
    expect(f.list).not.toHaveBeenCalled();
    f.config.set("llms", enabled);
    const response = await llmsRoute(f.route(), f.ctx);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ kind: "text" });
    expect(JSON.stringify(response)).toContain("Page 0");
    expect(JSON.stringify(response)).not.toContain("Secret body");
    expect(JSON.stringify(response)).not.toContain("Not exported either");
    f.config.set("llms", { enabled: false });
    expect((await llmsRoute(f.route(), f.ctx)).status).toBe(404);
  });
  it("excludes drafts, noindex, hidden/unroutable collections and alternate canonicals", async () => {
    const f = fixture(5);
    const [draft, noindex, canonical] = f.items;
    if (!draft || !noindex || !canonical) throw new Error("Missing fixture");
    draft.status = "draft";
    noindex.seo.noIndex = true;
    canonical.seo.canonical = "https://elsewhere.test/article";
    f.collections.push({
      ...(f.collections[0] as (typeof f.collections)[number]),
      slug: "hidden",
      hidden: true,
    });
    f.collections.push({
      ...(f.collections[0] as (typeof f.collections)[number]),
      slug: "private",
      routable: false,
    });
    const result = await generateLlms(f.ctx, enabled);
    expect(result.included).toBe(2);
    expect(result.text).toContain("Page 3");
    expect(result.text).not.toContain("Page 0");
    expect(result.text).not.toContain("Page 1");
    expect(result.text).not.toContain("Page 2");
    expect(f.list).toHaveBeenCalledTimes(1);
  });
  it("uses fresh eligibility after noindex changes and honors configured collections", async () => {
    const f = fixture(1);
    expect((await generateLlms(f.ctx, enabled)).included).toBe(1);
    const item = f.items[0];
    if (!item) throw new Error("Missing fixture");
    item.seo.noIndex = true;
    expect((await generateLlms(f.ctx, enabled)).included).toBe(0);
    expect(
      (await generateLlms(f.ctx, { ...enabled, collections: ["pages"] }))
        .scanned,
    ).toBe(0);
  });
  it.each([
    "",
    "https://",
    "not-a-url",
    "javascript:alert(1)",
  ])("fails closed for invalid site URL %s", async (value) => {
    const f = fixture();
    f.ctx.site.url = value;
    f.config.set("llms", enabled);
    expect((await llmsRoute(f.route(), f.ctx)).status).toBe(503);
    expect(f.list).not.toHaveBeenCalled();
    await expect(generateLlms(f.ctx, enabled)).rejects.toThrow("Site URL");
  });
  it.each([
    "https://other.test/post",
    "javascript:alert(1)",
    "https://user:pass@example.com/a",
    "https://example.com/_emdash/api/content",
    "https://example.com/post?preview=1",
  ])("does not expose unsafe or off-site content URL %s", async (url) => {
    const f = fixture(1);
    f.getPublicUrl.mockResolvedValue(url);
    expect((await generateLlms(f.ctx, enabled)).included).toBe(0);
  });
  it("keeps output bounded and tells editors about selection limits", async () => {
    const f = fixture(150);
    const result = await generateLlms(f.ctx, enabled);
    expect(result.scanned).toBe(LLMS_ENTRY_LIMIT);
    expect(result.included).toBe(LLMS_ENTRY_LIMIT);
    expect(result.truncated).toBe(true);
    expect(f.list).toHaveBeenCalledTimes(5);
    expect(f.getPublicUrl).toHaveBeenCalledTimes(LLMS_ENTRY_LIMIT);
    expect(JSON.stringify(await llmsPreview(f.ctx))).toContain(
      "Selected pages only",
    );
  });
  it("bounds empty collection iteration and rejects stuck pagination", async () => {
    const f = fixture(0);
    const first = f.collections[0];
    if (!first) throw new Error("Missing fixture");
    for (let n = 0; n < 30; n++)
      f.collections.push({ ...first, slug: `type-${n}` });
    const result = await generateLlms(f.ctx, enabled);
    expect(f.list).toHaveBeenCalledTimes(20);
    expect(result.truncated).toBe(true);
    f.list.mockResolvedValue({ items: [], cursor: "stuck", hasMore: true });
    f.list.mockClear();
    await expect(generateLlms(f.ctx, enabled)).rejects.toThrow(
      "pagination did not advance",
    );
    expect(f.list).toHaveBeenCalledTimes(1);
  });
  it("preserves site base paths and rejects links outside them", async () => {
    const f = fixture(1);
    f.ctx.site.url = "https://example.com/blog";
    expect(llmsUrls(f.ctx.site.url)?.endpoint).toBe(
      "https://example.com/blog/_emdash/api/plugins/quixseo/llms-txt",
    );
    expect((await generateLlms(f.ctx, enabled)).included).toBe(0);
    f.getPublicUrl.mockResolvedValue("https://example.com/blog/posts/0");
    expect((await generateLlms(f.ctx, enabled)).included).toBe(1);
  });
  it("escapes Markdown/HTML and clips by bytes without breaking a link", () => {
    const result = renderLlms("Title\n# injected", "<script>bad</script>", [
      {
        title: "][evil](https://bad.test)",
        url: "https://example.com/a(b)",
        collection: "Posts",
      },
    ]);
    expect(result.text).not.toContain("\n# injected");
    expect(result.text).not.toContain("<script>");
    expect(result.text).toContain("https://example.com/a%28b%29");
    expect(result.text).not.toContain("][evil]");
    const large = renderLlms(
      "Site",
      "",
      Array.from({ length: 100 }, (_, n) => ({
        title: "界".repeat(200),
        collection: "Posts",
        url: `https://example.com/${n}${"x".repeat(3000)}`,
      })),
    );
    expect(new TextEncoder().encode(large.text).length).toBeLessThanOrEqual(
      LLMS_BYTE_LIMIT,
    );
    expect(large.truncated).toBe(true);
    expect(large.text.trimEnd().endsWith(")")).toBe(true);
  });
  it("validates requests, supplies download headers and hides public exception details", async () => {
    const f = fixture();
    f.config.set("llms", enabled);
    expect(
      (await llmsRoute(f.route({ collection: "private" }), f.ctx)).status,
    ).toBe(400);
    const download = await llmsRoute(f.route({ download: "1" }), f.ctx);
    expect(download.headers).toContainEqual([
      "content-disposition",
      'attachment; filename="llms.txt"',
    ]);
    const head = f.route();
    head.request.method = "HEAD";
    expect((await llmsRoute(head, f.ctx)).body).toBeNull();
    f.list.mockRejectedValue(new Error("PRIVATE database diagnostic"));
    const failed = await llmsRoute(f.route(), f.ctx);
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed)).not.toContain("PRIVATE");
    await expect(generateLlms(f.ctx, enabled)).rejects.toThrow("PRIVATE");
  });
  it("requires an administrator to save and preserves all existing settings", async () => {
    const f = fixture();
    f.config.set("site", { defaultDescription: "Keep my SEO configuration" });
    const input = {
      type: "form_submit",
      action_id: "save-llms",
      values: { enabled: true, summary: "Our site", collections: "posts" },
    };
    const route = {
      ...f.route(input),
      user: { id: "editor", role: 40 },
    } as SandboxedRouteContext;
    await expect(admin(route, f.ctx)).rejects.toThrow("Permission denied");
    await admin(
      { ...route, user: { id: "admin", role: 50 } } as SandboxedRouteContext,
      f.ctx,
    );
    expect(f.config.get("site")).toEqual({
      defaultDescription: "Keep my SEO configuration",
    });
    expect(f.config.get("llms")).toEqual({
      enabled: true,
      summary: "Our site",
      collections: ["posts"],
    });
    const ui = JSON.stringify(await llmsBlocks(f.ctx));
    expect(ui).toContain("robots.txt reference (manual setup)");
    expect(ui).toContain("# llms.txt: https://example.com/llms.txt");
    expect(ui).toContain("no standard Llms:");
  });
});

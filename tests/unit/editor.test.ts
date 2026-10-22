import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import { describe, expect, it } from "vitest";
import { draft, editor } from "../../src/ui/editor.js";
import { garden } from "../fixtures/articles.js";

function fixture() {
  const site = { url: "", locale: "en" };
  const getPublicUrl = async () =>
    site.url ? `${site.url}/posts/garden` : null;
  const ctx = {
    site,
    storage: {
      entries: {
        get: async () => ({ keyphrases: ["garden"], cornerstone: true }),
      },
      settings: { get: async () => ({ readability: false }) },
    },
    content: {
      getPublicUrl,
      get: async () => ({
        id: "entry",
        slug: "garden",
        locale: "en",
        data: {
          title: garden.title,
          body: garden.body,
          excerpt: garden.description,
        },
        seo: {
          title: null,
          description: null,
          image: null,
          canonical: null,
          noIndex: false,
        },
      }),
    },
    schema: {
      getCollection: async () => ({
        titleField: "title",
        fields: [{ type: "portableText", slug: "body" }],
      }),
    },
  } as unknown as PluginContext;
  const route = {
    user: { id: "author", role: 30 },
    ui: {
      surface: "content-editor-panel",
      entry: { id: "entry", collection: "posts" },
    },
    input: { type: "panel_load" },
  } as unknown as SandboxedRouteContext;
  return { ctx, route, site };
}
describe("editor URL lifecycle", () => {
  it("uses changed configuration on the next call without clearing storage or reinitializing the plugin", async () => {
    const { ctx, route, site } = fixture();
    const first = JSON.stringify(await editor(route, ctx));
    expect(first).toContain("Site URL not configured");
    expect(first).toContain("source: excerpt fallback");
    expect(first).toContain("garden");
    site.url = "https://real.test";
    const second = JSON.stringify(await editor(route, ctx));
    expect(second).not.toContain("Site URL not configured");
    expect(second).toContain("https://real.test/posts/garden");
    expect(second).toContain("Readability is disabled");
  });
  it("does not replace content-service or permission failures with missing URL warnings", async () => {
    const { ctx, route } = fixture();
    if (!ctx.content) throw new Error("Missing fixture");
    ctx.content.getPublicUrl = async () => {
      throw new Error("Content service unavailable");
    };
    await expect(editor(route, ctx)).rejects.toThrow(
      "Content service unavailable",
    );
    await expect(editor({ ...route, user: undefined }, ctx)).rejects.toThrow(
      "Permission denied",
    );
  });
  it("uses saved keyphrases and language/settings for drafts, without pretending the saved path is the draft URL", async () => {
    const { ctx, route, site } = fixture();
    site.url = "https://example.com";
    const result = await draft(
      {
        ...route,
        ui: {
          surface: "content-editor-action",
          entry: { collection: "posts", id: "entry" },
        },
        input: {
          draft: {
            fields: {
              title: "Another topic",
              excerpt: "Summary",
              body: Array.isArray(garden.body)
                ? garden.body.slice(0, 1)
                : garden.body,
            },
          },
        },
      } as SandboxedRouteContext,
      ctx,
    );
    const text = JSON.stringify(result);
    expect(text).toContain("partial analysis");
    expect(text).toContain("“garden”");
    expect(text).toContain(
      "Saved SEO metadata and unsaved URL changes are not assessed",
    );
    expect(text).not.toContain("Site URL not configured");
  });
});

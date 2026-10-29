import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import { describe, expect, it } from "vitest";
import { editorContent } from "../../src/services/editor-content.js";
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
        status: "published",
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
  if (!ctx.content || !ctx.schema)
    throw new Error("Fixture capabilities missing");
  return {
    ctx: ctx as PluginContext & {
      content: NonNullable<PluginContext["content"]>;
      schema: NonNullable<PluginContext["schema"]>;
    },
    route,
    site,
  };
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
            collection: "posts",
            entryId: "entry",
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
      "Saved SEO metadata is used; unsaved URL changes are not assessed",
    );
    expect(text).not.toContain("Site URL not configured");
  });
});

describe("saved and current editor content", () => {
  const ref = { collection: "posts", id: "entry" };
  it("reads only the current entry's draft pointer and keeps its published snapshot intact", async () => {
    const { ctx } = fixture();
    const live = await ctx.content.get("posts", "entry");
    if (!live) throw new Error("Fixture missing");
    live.liveRevisionId = "live";
    live.draftRevisionId = "draft";
    ctx.content.get = async () => live;
    let reads = 0;
    ctx.content.getRevision = async (collection, entryId, id) => {
      expect([collection, entryId, id]).toEqual(["posts", "entry", "draft"]);
      reads++;
      return {
        id,
        collection,
        entryId,
        createdAt: "2026-10-26",
        data: { ...live.data, body: heading },
      };
    };
    const result = await editorContent(ctx, ref);
    expect(result.source).toBe("Saved draft — unpublished changes");
    expect(result.data.body).toEqual(heading);
    expect(live.data.body).toEqual(garden.body);
    expect(reads).toBe(1);
    live.draftRevisionId = "live";
    expect((await editorContent(ctx, ref)).source).toBe("Published content");
    expect(reads).toBe(1);
  });
  it.each([
    "missing",
    "denied",
    "wrong-entry",
    "unavailable",
  ])("labels the published fallback when a draft is %s", async (mode) => {
    const { ctx } = fixture();
    const live = await ctx.content.get("posts", "entry");
    if (!live) throw new Error("Fixture missing");
    live.draftRevisionId = "draft";
    live.liveRevisionId = "live";
    ctx.content.get = async () => live;
    ctx.content.getRevision =
      mode === "unavailable"
        ? undefined
        : async () => {
            if (mode === "denied") throw new Error("Access denied");
            return mode === "missing"
              ? null
              : {
                  id: "draft",
                  collection: "posts",
                  entryId: "someone-else",
                  createdAt: "2026-10-26",
                  data: { body: heading },
                };
          };
    const result = await editorContent(ctx, ref);
    expect(result.source).toBe("Published content");
    expect(result.warning).toContain("Showing published content");
    expect(result.data.body).toEqual(garden.body);
  });
  it("uses configured Portable Text fields and equivalent saved metadata for both draft paths", async () => {
    const { ctx, route, site } = fixture();
    site.url = "https://example.com";
    const item = await ctx.content.get("posts", "entry");
    if (!item) throw new Error("Fixture missing");
    item.draftRevisionId = "draft";
    item.liveRevisionId = "live";
    const data = {
      title: garden.title,
      excerpt: garden.description,
      article_text: garden.body,
    };
    ctx.content.get = async () => item;
    ctx.schema.getCollection = async () =>
      ({
        titleField: "title",
        fields: [{ slug: "article_text", type: "portableText" }],
      }) as never;
    ctx.content.getRevision = async () => ({
      id: "draft",
      collection: "posts",
      entryId: "entry",
      createdAt: "2026-10-26",
      data,
    });
    const saved = await editorContent(ctx, ref);
    const snapshot = { collection: "posts", entryId: "entry", fields: data };
    const current = await editorContent(ctx, ref, snapshot);
    expect(current.analysis).toEqual(saved.analysis);
    expect(current.analysis.wordCount).toBeGreaterThan(0);
    const fullPanel = JSON.stringify(
      await editor(
        {
          ...route,
          input: {
            type: "block_action",
            action_id: "analyze-current",
            draft: snapshot,
          },
        } as SandboxedRouteContext,
        ctx,
      ),
    );
    expect(fullPanel).toContain("Current editor — unsaved changes");
    expect(fullPanel).toContain("Recommendation");
    expect(fullPanel).toContain("Partial analysis");
    const absent = await editorContent(ctx, ref, {
      ...snapshot,
      fields: { title: data.title },
    });
    expect(absent.warning).toContain("article_text");
    expect(absent.analysis.assessment.unavailable).toBeGreaterThan(
      current.analysis.assessment.unavailable,
    );
    await expect(
      editorContent(ctx, ref, { ...snapshot, entryId: "other" }),
    ).rejects.toThrow("another entry");
  });
});

const heading = [
  {
    _type: "block",
    _key: "h",
    style: "h2",
    children: [{ _type: "span", _key: "s", text: "Checkout steps", marks: [] }],
    markDefs: [],
  },
];

describe("ordinary settings save", () => {
  it("removes native inputs and saves existing plugin overrides without native writes or publishing", async () => {
    const { ctx, route } = fixture();
    const original = await ctx.content.get("posts", "entry");
    if (!original) throw new Error("missing");
    original.status = "draft";
    original.seo = {
      title: "Native title",
      description: "Native description",
      canonical: "/original",
      image: "/native.jpg",
      noIndex: true,
    };
    ctx.content.get = async () => structuredClone(original);
    const buckets = new Map<string, { value: unknown; revision: string }>();
    let serial = 0;
    for (const name of ["entries", "changes"]) {
      const key = (id: string) => `${name}/${id}`;
      ctx.storage[name] = {
        get: async (id: string) =>
          structuredClone(buckets.get(key(id))?.value ?? null),
        getVersioned: async (id: string) =>
          structuredClone(buckets.get(key(id)) ?? null),
        put: async (id: string, value: unknown) => {
          buckets.set(key(id), {
            value: structuredClone(value),
            revision: String(++serial),
          });
        },
        compareAndSet: async (
          id: string,
          revision: string | null,
          value: unknown,
        ) => {
          if ((buckets.get(key(id))?.revision ?? null) !== revision)
            return { applied: false };
          const next = String(++serial);
          buckets.set(key(id), {
            value: structuredClone(value),
            revision: next,
          });
          return { applied: true, revision: next };
        },
      } as never;
    }
    await ctx.storage.entries?.put("posts:entry", {
      ogTitle: "Existing override",
      cornerstone: true,
    });
    const panel = await editor(route, ctx);
    const form = panel.blocks.find((b) => b.type === "form");
    if (form?.type !== "form") throw new Error("Missing form");
    const values = Object.fromEntries(
      form.fields.map((f) => [
        f.action_id,
        "initial_value" in f ? f.initial_value : "",
      ]),
    );
    for (const native of [
      "title",
      "description",
      "canonical",
      "image",
      "noIndex",
    ])
      expect(values).not.toHaveProperty(native);
    expect(JSON.stringify(panel)).not.toContain('"type":"stats"');
    const submit = {
      ...route,
      input: {
        type: "form_submit",
        action_id: form.submit.action_id,
        values: { ...values, keyphrases: "garden" },
      },
    } as SandboxedRouteContext;
    const invalid = await editor(
      {
        ...submit,
        input: {
          type: "form_submit",
          action_id: form.submit.action_id,
          values: {
            ...values,
            schema: "invalid JSON",
            keyphrases: "keep my edits",
          },
        },
      } as SandboxedRouteContext,
      ctx,
    );
    expect(invalid.toast?.type).toBe("error");
    expect(JSON.stringify(invalid)).toContain("keep my edits");
    expect(JSON.stringify(invalid)).toContain("invalid JSON");
    const result = await editor(submit, ctx);
    expect(result.toast?.message).toContain("settings saved");
    expect(await ctx.storage.entries?.get("posts:entry")).toMatchObject({
      keyphrases: ["garden"],
      ogTitle: "Existing override",
      cornerstone: true,
    });
    expect(await ctx.content.get("posts", "entry")).toEqual(original);
    expect(JSON.stringify(await editor(route, ctx))).toContain("garden");
    expect(JSON.stringify(await editor(submit, ctx))).toContain(
      "changed since this form",
    );
    await expect(editor({ ...submit, user: undefined }, ctx)).rejects.toThrow(
      "Permission denied",
    );
    const journals = [...buckets.entries()].filter(([k]) =>
      k.startsWith("changes/"),
    );
    for (const [, row] of journals) {
      const plan = row.value as {
        rows: { beforeSeo: unknown; afterSeo: unknown; seo: unknown }[];
      };
      expect(plan.rows[0]?.seo).toEqual({});
      expect(plan.rows[0]?.afterSeo).toEqual(plan.rows[0]?.beforeSeo);
    }
  });
});

import {
  createPublicPageContext,
  generateBaseSeoContributions,
  renderPageMetadata,
  resolvePageMetadata,
} from "emdash/page";
import { describe, expect, it } from "vitest";
import { schemaGraph } from "../../src/domain/schema.js";
import { settingsSchema } from "../../src/domain/validation.js";

describe("actual EmDash head resolver", () => {
  it("deduplicates core metadata and competing primary graphs", () => {
    const page = createPublicPageContext({
      url: "https://example.com/garden",
      kind: "content",
      title: "Garden",
      description: "Native summary",
      canonical: "https://example.com/garden",
    });
    const graph = schemaGraph(page, settingsSchema.parse({}), null);
    if (!graph) throw new Error("Expected graph");
    const result = resolvePageMetadata([
      { kind: "property", property: "og:title", content: "QuixSEO override" },
      { kind: "jsonld", id: "primary", graph },
      { kind: "property", property: "og:title", content: "Second emitter" },
      {
        kind: "jsonld",
        id: "primary",
        graph: { "@type": "WebPage", name: "Second emitter" },
      },
      ...generateBaseSeoContributions(page),
    ]);
    const html = renderPageMetadata(result);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
    expect(html).toContain("QuixSEO override");
    expect(html).not.toContain("Second emitter");
  });
  it("escapes user strings without a script breakout or HTML attribute injection", () => {
    const payload = '</script><script>alert(1)</script>" onload="alert(2)';
    const html = renderPageMetadata(
      resolvePageMetadata([
        { kind: "meta", name: "description", content: payload },
        {
          kind: "jsonld",
          id: "primary",
          graph: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: payload,
          },
        },
      ]),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&quot;");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html.match(/<script /g)).toHaveLength(1);
  });
});

it("renders actual QuixSEO contributions with core fallbacks once per metadata key", async () => {
  const { metadata } = await import("../../src/services/metadata.js");
  const page = createPublicPageContext({
    url: "https://example.com/garden",
    kind: "content",
    title: "Native title",
    description: "Native description",
    canonical: "https://example.com/garden",
    image: "https://example.com/native.jpg",
    content: { collection: "posts", id: "entry" },
  });
  const ctx = {
    storage: {
      settings: { get: async () => ({ metadata: true, schema: true }) },
      entries: {
        get: async () => ({
          ogTitle: "OG override",
          twitterTitle: "X override",
        }),
      },
    },
  } as unknown as import("emdash/plugin").PluginContext;
  const contributions = await metadata({ page }, ctx);
  const html = renderPageMetadata(
    resolvePageMetadata([
      ...contributions,
      ...generateBaseSeoContributions(page),
    ]),
  );
  for (const key of [
    'name="description"',
    'rel="canonical"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'name="twitter:title"',
    'name="twitter:description"',
    'name="twitter:image"',
    'name="twitter:card"',
    "application/ld+json",
  ]) {
    expect(html.split(key).length - 1, key).toBe(1);
  }
  expect(html).toContain("OG override");
  expect(html).toContain("X override");
  expect(html).toContain("Native description");
  expect(html).not.toContain("<title"); // EmDashHead owns the title element.
});

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

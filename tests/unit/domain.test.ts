import { describe, expect, it } from "vitest";
import type { AnalysisInput } from "../../src/domain/analysis.js";
import { analyze, readingEase, score } from "../../src/domain/analysis.js";
import {
  classifyLinks,
  extractDocument,
  hasPhrase,
} from "../../src/domain/content.js";
import { migrateRow } from "../../src/domain/migration.js";
import {
  localPath,
  redirectIssues,
  redirectSchema,
} from "../../src/domain/redirects.js";
import { schemaGraph, validateSchema } from "../../src/domain/schema.js";
import {
  canonicalUrl,
  emptySeo,
  entryConfigSchema,
  expandTemplate,
  fingerprint,
  httpUrl,
  schemaConfig,
  schemaTypes,
  settingsSchema,
} from "../../src/domain/validation.js";

const paragraph = (text: string, style = "normal") => ({
  _type: "block",
  _key: crypto.randomUUID(),
  style,
  children: [{ _type: "span", text, marks: [] }],
  markDefs: [],
});
const base: AnalysisInput = {
  title: "Garden care",
  description: "Practical garden care tips.",
  url: "https://example.com/garden-care",
  body: [
    paragraph(
      "Garden care starts with water. However, too much water can harm roots.",
    ),
    paragraph("Garden care tips", "h2"),
  ],
  keyphrases: ["garden care"],
  locale: "en",
  readability: true,
  language: "auto",
};
const check = (id: string, change: Partial<AnalysisInput> = {}) =>
  analyze({ ...base, ...change }).checks.find((c) => c.id === id);
describe("Every deterministic scoring rule", () => {
  it.each([
    ["seo.title", { title: "" }],
    ["seo.description", { description: "" }],
    ["seo.title-width", { title: "x".repeat(66) }],
    ["seo.description-width", { description: "x".repeat(171) }],
    ["seo.body", { body: [] }],
    ["seo.headings", { body: [paragraph("A", "h2"), paragraph("B", "h4")] }],
  ] as const)("%s detects its issue", (id, change) => {
    expect(check(id, change)?.status).not.toBe("good");
    expect(check(id)?.status).toBe("good");
  });
  it("internal link rule uses actual marked spans", () => {
    const body = [
      {
        _type: "block",
        children: [{ text: "Read more", marks: ["link"] }],
        markDefs: [{ _key: "link", _type: "link", href: "/about" }],
      },
    ];
    expect(check("seo.internal-links")?.status).toBe("improve");
    expect(check("seo.internal-links", { body })?.status).toBe("good");
  });
  it("external links are informational, with no quota", () => {
    expect(check("seo.external-links")).toMatchObject({
      weight: 0,
      status: "good",
    });
  });
  it("alt check respects explicitly decorative images", () => {
    expect(
      check("seo.image-alt", { body: [{ _type: "image", alt: "" }] })?.status,
    ).toBe("improve");
    expect(
      check("seo.image-alt", {
        body: [{ _type: "image", alt: "", decorative: true }],
      })?.status,
    ).toBe("good");
  });
  it("unsafe marked links fail", () => {
    expect(
      check("seo.invalid-links", {
        body: [
          {
            _type: "block",
            children: [{ text: "x", marks: ["a"] }],
            markDefs: [{ _key: "a", href: "javascript:alert(1)" }],
          },
        ],
      })?.status,
    ).toBe("problem");
    expect(check("seo.invalid-links")?.status).toBe("good");
  });
  it.each([
    "title",
    "description",
    "url",
    "headings",
    "introduction",
    "body",
  ])("keyword location %s is checked independently", (field) => {
    expect(check(`keyword.0.${field}`)?.status).toBe("good");
    expect(
      analyze({ ...base, keyphrases: ["missing phrase"] }).checks.find(
        (c) => c.id === `keyword.0.${field}`,
      )?.status,
    ).toBe("improve");
  });
  it("empty optional keyphrases do not reduce score", () => {
    expect(
      analyze({ ...base, keyphrases: [] }).checks.find(
        (c) => c.id === "keyword.none",
      ),
    ).toMatchObject({ status: "unsupported", weight: 0 });
  });
  it("paragraph rule", () => {
    expect(check("readability.paragraphs")?.status).toBe("good");
    expect(
      check("readability.paragraphs", {
        body: [paragraph("word ".repeat(121))],
      })?.status,
    ).toBe("improve");
  });
  it("section rule", () => {
    expect(check("readability.sections")?.status).toBe("good");
    expect(
      check("readability.sections", { body: [paragraph("word ".repeat(301))] })
        ?.status,
    ).toBe("improve");
  });
  it("sentence rule", () => {
    expect(check("readability.sentences")?.status).toBe("good");
    expect(
      check("readability.sentences", {
        body: [paragraph(`${"word ".repeat(26)}.`)],
      })?.status,
    ).toBe("improve");
  });
  it("repetition rule", () => {
    expect(check("readability.repetition")?.status).toBe("good");
    expect(
      check("readability.repetition", {
        body: [paragraph("This page helps. This page shows. This page works.")],
      })?.status,
    ).toBe("improve");
  });
  it("transition rule", () => {
    expect(check("readability.transitions")?.status).toBe("good");
    expect(
      check("readability.transitions", {
        body: [
          paragraph(
            "A cat sat. A dog ran. A bird flew. A fish swam. A cow ate.",
          ),
        ],
      })?.status,
    ).toBe("improve");
  });
  it("reading ease rule", () => {
    expect(check("readability.ease")?.status).toBe("good");
    expect(
      check("readability.ease", {
        body: [
          paragraph(
            "Internationalization institutionalization characterization interoperability.",
          ),
        ],
      })?.status,
    ).toBe("improve");
  });
  it("unsupported languages and empty content are explicit", () => {
    const a = analyze({ ...base, locale: "ja" });
    expect(a.readingEase).toBeNull();
    expect(a.checks.some((c) => c.id === "readability.language")).toBe(true);
    expect(
      analyze({ ...base, body: [] }).checks.some(
        (c) => c.id === "readability.empty",
      ),
    ).toBe(true);
  });
  it("score is weighted and excludes informational rules", () => {
    expect(score([])).toBeNull();
    expect(
      score([
        { id: "a", status: "good", weight: 3, message: "", category: "seo" },
        { id: "b", status: "problem", weight: 1, message: "", category: "seo" },
      ]),
    ).toBe(75);
    expect(readingEase("")).toBeNull();
  });
});
describe("Safe content and URLs", () => {
  it("word boundaries and Unicode matching", () => {
    expect(hasPhrase("The carpet", "car")).toBe(false);
    expect(hasPhrase("CAFÉ life", "café")).toBe(true);
  });
  it("does not count unused link definitions", () => {
    expect(
      extractDocument([
        {
          _type: "block",
          children: [{ text: "Hi", marks: [] }],
          markDefs: [{ _key: "unused", href: "/bad" }],
        },
      ]).links,
    ).toEqual([]);
  });
  it("reports unsupported custom blocks and HTML", () => {
    expect(extractDocument([{ _type: "video" }]).unsupported).toEqual([
      "video",
    ]);
    expect(extractDocument("<p>HTML</p>").unsupported).not.toHaveLength(0);
  });
  it("bounds analysis work", () => {
    expect(() => extractDocument("x".repeat(200001))).toThrow();
    expect(() => extractDocument(Array(5001).fill({}))).toThrow();
  });
  it("classifies relative paths without fetching", () => {
    expect(
      classifyLinks(
        [
          "../next",
          "https://other.test/a",
          "mailto:a@b.test",
          "//example.com/z",
        ],
        "https://example.com/posts/a",
      ),
    ).toMatchObject({
      internal: ["https://example.com/next", "https://example.com/z"],
      external: ["https://other.test/a"],
      invalid: [],
    });
  });
  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://u:p@example.com",
    "https://example.com/ bad",
    "https://example.com\\bad",
  ])("rejects unsafe metadata URL %s", (url) => {
    expect(() => httpUrl(url)).toThrow();
  });
  it("canonical keeps meaningful query and strips fragment", () =>
    expect(canonicalUrl("https://example.com/list?page=2#x")).toBe(
      "https://example.com/list?page=2",
    ));
  it("templates have an allowlist and no evaluation", () => {
    const vars = {
      title: "Title",
      site: "Site",
      separator: "|",
      excerpt: "Text",
      slug: "title",
    };
    expect(expandTemplate("{title} {separator} {site}", vars)).toBe(
      "Title | Site",
    );
    expect(() => expandTemplate("{process.env}", vars)).toThrow();
  });
  it("fingerprints are independent of object key order", async () =>
    expect(await fingerprint({ b: 1, a: 2 })).toBe(
      await fingerprint({ a: 2, b: 1 }),
    ));
});
describe("Redirect validation", () => {
  it.each([
    "//evil.test",
    "/a?b=1",
    "/a#b",
    "/a/../b",
    "/a%2fb",
    "/x\\y",
    "/old/[slug]",
  ])("rejects ambiguous source %s", (p) =>
    expect(() => localPath(p)).toThrow());
  it("rejects self redirect", () =>
    expect(() =>
      redirectSchema.parse({ source: "/a", destination: "/a", type: 301 }),
    ).toThrow());
  it("detects duplicates, chains and loops", () => {
    const rules = [
      { source: "/a", destination: "/b", type: 301 as const },
      { source: "/b", destination: "/a", type: 302 as const },
      { source: "/a", destination: "/b", type: 301 as const },
    ];
    expect(redirectIssues(rules).map((i) => i.issue)).toContain(
      "Duplicate or conflicting source",
    );
    expect(redirectIssues(rules).map((i) => i.issue)).toContain(
      "Redirect loop",
    );
    expect(
      redirectIssues([
        { source: "/a", destination: "/b", type: 301 },
        { source: "/b", destination: "/c", type: 301 },
      ])[0]?.issue,
    ).toContain("chain");
  });
});
describe("Schema and migration", () => {
  const page = {
    url: "https://example.com/a",
    path: "/a",
    canonical: "https://example.com/a",
    locale: "en",
    kind: "content" as const,
    pageType: "article",
    title: "Actual title",
    description: "Actual description",
    image: null,
  };
  it.each(schemaTypes)("builds validated %s", (type) => {
    const config = schemaConfig.parse({
      type,
      name: "Real name",
      description: "Real facts",
      image: "https://example.com/photo.jpg",
      author: "Writer",
      street: "1 Main",
      city: "Town",
      country: "US",
      visibleContentConfirmed: true,
      questions: [{ question: "Why?", answer: "Here is why." }],
      breadcrumbs: [{ name: "Home", url: "https://example.com/" }],
    });
    expect(validateSchema(config)).toEqual([]);
    const graph = schemaGraph(page, settingsSchema.parse({}), config);
    expect(JSON.stringify(graph)).toContain(type);
    expect(JSON.stringify(graph)).not.toContain("aggregateRating");
  });
  it("rejects fabricated/unknown schema fields and incomplete products", () => {
    expect(() =>
      schemaConfig.parse({
        type: "Product",
        aggregateRating: { ratingValue: 5 },
      }),
    ).toThrow();
    expect(
      validateSchema(schemaConfig.parse({ type: "Product" })).length,
    ).toBeGreaterThan(0);
  });
  it("does not create an offer from currency alone", () =>
    expect(validateSchema(schemaConfig.parse({ currency: "USD" }))).toContain(
      "An offer requires both a price and ISO currency.",
    ));
  const vars = {
    title: "Native title",
    site: "Example",
    separator: "|",
    excerpt: "Native summary",
    slug: "native",
  };
  it("maps Yoast free metadata without implicit indexing", () => {
    const row = migrateRow(
      {
        source: "yoast",
        collection: "posts",
        id: "entry",
        meta: {
          _yoast_wpseo_title: "%%title%% %%sep%% %%sitename%%",
          _yoast_wpseo_focuskw: "garden care",
          "_yoast_wpseo_meta-robots-noindex": "0",
          _yoast_wpseo_unknown: "x",
        },
      },
      vars,
    );
    expect(row.seo.title).toBe("Native title | Example");
    expect(row.seo.noIndex).toBeUndefined();
    expect(row.config.keyphrases).toEqual(["garden care"]);
    expect(row.warnings.length).toBe(2);
  });
  it("maps Rank Math multiple keyphrases and explicit robots", () => {
    const row = migrateRow(
      {
        source: "rankmath",
        collection: "pages",
        id: "entry",
        meta: {
          rank_math_focus_keyword: "one,two",
          rank_math_canonical_url: "https://example.com/canonical",
          rank_math_robots: ["noindex", "nofollow"],
          rank_math_facebook_title: "Social",
        },
      },
      vars,
    );
    expect(row.seo.noIndex).toBe(true);
    expect(row.seo.canonical).toBe("https://example.com/canonical");
    expect(row.config).toMatchObject({
      keyphrases: ["one", "two"],
      noFollow: true,
      ogTitle: "Social",
    });
  });
  it("does not execute PHP serialized data or unknown variables", () => {
    const row = migrateRow(
      {
        source: "rankmath",
        collection: "pages",
        id: "entry",
        meta: {
          rank_math_robots: 'O:8:"Exploit"',
          rank_math_title: "%unknown%",
        },
      },
      vars,
    );
    expect(row.seo).toEqual({});
    expect(row.warnings.length).toBe(2);
  });
  it("rejects unsafe imports", () =>
    expect(() =>
      migrateRow(
        {
          source: "yoast",
          collection: "posts",
          id: "entry",
          meta: { _yoast_wpseo_canonical: "javascript:x" },
        },
        vars,
      ),
    ).toThrow());
  it("preserves defaults", () =>
    expect(entryConfigSchema.parse({}).keyphrases).toEqual([]));
  it("native default is indexable", () => expect(emptySeo.noIndex).toBe(false));
});
it("analyzes 10,000 content records without accumulating full bodies", () => {
  const start = performance.now();
  let total = 0;
  for (let i = 0; i < 10000; i++)
    total +=
      analyze({ ...base, keyphrases: [], readability: false }).score ?? 0;
  expect(total).toBeGreaterThan(0);
  expect(performance.now() - start).toBeLessThan(10000);
});

it("preserves native relative canonicals and media IDs without allowing executable schemes", async () => {
  const { seoSchema, emptySeo } = await import(
    "../../src/domain/validation.js"
  );
  expect(
    seoSchema.parse({
      ...emptySeo,
      image: "01M5FXEMZT3W064TWDKAF53HNH",
      canonical: "/posts/garden",
    }),
  ).toMatchObject({
    image: "01M5FXEMZT3W064TWDKAF53HNH",
    canonical: "/posts/garden",
  });
  expect(() =>
    seoSchema.parse({ ...emptySeo, image: "javascript:alert(1)" }),
  ).toThrow();
});

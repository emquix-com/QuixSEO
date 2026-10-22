import { describe, expect, it } from "vitest";
import type {
  Analysis,
  AnalysisInput,
  Check,
} from "../../src/domain/analysis.js";
import { analyze, score } from "../../src/domain/analysis.js";
import { classifyLinks } from "../../src/domain/content.js";
import {
  analysisUrls,
  resolveCanonical,
  usableUrl,
} from "../../src/domain/urls.js";
import { analysisBlocks } from "../../src/ui/components.js";
import { checkout, garden, linked, paragraph } from "../fixtures/articles.js";

function present<T>(value: T | undefined | null): T {
  if (value === null || value === undefined)
    throw new Error("Expected fixture value");
  return value;
}
const rule = (a: Analysis, id: string) =>
  present(a.checks.find((c) => c.id === id));
const run = (change: Partial<AnalysisInput> = {}) =>
  analyze({ ...garden, ...change });
const prose = garden.body as ReturnType<typeof paragraph>[];

describe("URL evidence, without invented public routes", () => {
  it.each([
    undefined,
    null,
    "",
    " ",
    "example.com",
    "/posts/a",
    "https://",
    "https:/example.com",
    "not a URL",
    "https://example.com/ bad",
    "https://user:secret@example.com",
    "ftp://example.com",
    "javascript:alert(1)",
    "https://example.com\\bad",
    "https://[bad",
    "https://example.com\n",
  ])("treats %s as unavailable while preserving text checks", (url) => {
    expect(usableUrl(url)).toBeNull();
    const a = run({ url, siteUrl: url });
    expect(a.score).not.toBeNull();
    for (const id of [
      "seo.title",
      "seo.description",
      "seo.body",
      "readability.paragraphs",
    ])
      expect(rule(a, id).status).toBe("good");
    expect(rule(a, "seo.sections").status).toBe("improve");
    expect(rule(a, "seo.internal-links")).toMatchObject({
      status: "unsupported",
      reason: "unavailable",
    });
    expect(a.linksAssessed).toBe(false);
    expect(a.assessment.unavailable).toBeGreaterThan(0);
    expect(a.internal).toEqual([]);
  });
  it("prefers a valid content URL even when the site setting is invalid", () => {
    const urls = analysisUrls("bad", "https://published.example/article#part");
    expect(urls).toEqual({
      site: null,
      page: "https://published.example/article",
      origin: "https://published.example",
    });
    expect(run({ siteUrl: "bad", url: urls.page }).linksAssessed).toBe(true);
  });
  it("uses localhost for local analysis without claiming it is reachable", () => {
    expect(usableUrl("http://localhost:4321/posts/a")?.hostname).toBe(
      "localhost",
    );
  });
  it("rejects a fake host salvaged from EmDash's malformed base concatenation", () => {
    expect(analysisUrls("https:/", "https://posts/garden")).toEqual({
      site: null,
      page: null,
      origin: null,
    });
    expect(
      analysisUrls(
        "https://example.com?bad",
        "https://example.com?bad/posts/garden",
      ).page,
    ).toBeNull();
    expect(
      analysisUrls(
        "https://example.com#bad",
        "https://example.com#bad/posts/garden",
      ).page,
    ).toBeNull();
  });
  it("does not treat a site origin as a draft route", () => {
    const a = run({
      url: null,
      siteUrl: "https://example.com",
      body: [linked("Read another page", "../another")],
      keyphrases: ["garden"],
    });
    expect(rule(a, "keyword.0.url").status).toBe("unsupported");
    expect(rule(a, "seo.internal-links").status).toBe("unsupported");
    expect(a.internal).toEqual([]);
    expect(
      classifyLinks(
        ["/about", "https://external.test/"],
        null,
        "https://example.com",
      ),
    ).toMatchObject({
      internal: ["https://example.com/about"],
      external: ["https://external.test/"],
      classified: true,
    });
  });
  it("continues to find unsafe links without a base URL", () => {
    const a = run({
      url: null,
      body: [linked("Unsafe", "javascript:alert(1)")],
    });
    expect(rule(a, "seo.invalid-links").status).toBe("problem");
  });
  it("never calls an absolute link external without a known site origin", () => {
    expect(classifyLinks(["https://example.com/a"], null)).toMatchObject({
      internal: [],
      external: [],
      unresolved: ["https://example.com/a"],
      classified: false,
    });
  });
  it("compares only validated canonicals and strips fragments", () => {
    const missing = analysisUrls("", null);
    expect(resolveCanonical("/article", missing)).toBeNull();
    expect(resolveCanonical("bad", missing)).toBeNull();
    expect(resolveCanonical("https://real.test/article#part", missing)).toBe(
      "https://real.test/article",
    );
    const known = analysisUrls("", "https://real.test/posts/a");
    expect(resolveCanonical("/article", known)).toBe(
      "https://real.test/article",
    );
    expect(resolveCanonical("//evil.test/a", known)).toBeNull();
  });
  it("recovers on the next analysis without cached URL state", () => {
    const missing = run({ url: "", siteUrl: "" });
    const fixed = run({ url: garden.url, siteUrl: "https://example.com" });
    expect(missing.linksAssessed).toBe(false);
    expect(fixed.linksAssessed).toBe(true);
    expect(rule(fixed, "seo.internal-links").status).toBe("improve");
    expect(fixed.assessment.unavailable).toBe(0);
  });
});

describe("Editorial scoring and applicability", () => {
  it("scores empty content as empty, not as successful absent checks", () => {
    const empty = run({ title: "", description: "", body: [] });
    expect(empty.score).toBe(0);
    for (const id of ["seo.title", "seo.description", "seo.body"])
      expect(rule(empty, id).status).toBe("problem");
    for (const id of [
      "seo.headings",
      "seo.image-alt",
      "seo.invalid-links",
      "seo.title-width",
      "seo.description-width",
    ])
      expect(rule(empty, id).status).toBe("unsupported");
    expect(empty.readabilityScore).toBeNull();
    const fragment = run({ body: [paragraph("Hello.")] });
    expect(rule(fragment, "seo.body").status).toBe("improve");
    expect(fragment.score).toBeLessThan(
      present(run({ body: [prose[0]] }).score),
    );
  });
  it("allows a useful concise answer without requiring headings, images or links", () => {
    const a = run({ body: [prose[0]] });
    expect(rule(a, "seo.body").status).toBe("good");
    for (const id of [
      "seo.sections",
      "seo.headings",
      "seo.internal-links",
      "seo.image-alt",
    ])
      expect(rule(a, id).status).toBe("unsupported");
    expect(a.score).toBe(100);
  });
  it("separates missing sectioning from hierarchy validity", () => {
    const weak = run();
    expect(rule(weak, "seo.sections").status).toBe("improve");
    expect(rule(weak, "seo.headings").status).toBe("unsupported");
    const structured = run({
      body: [
        prose[0],
        paragraph("Water and drainage", "h2"),
        ...prose.slice(1),
      ],
    });
    expect(structured.score).toBeGreaterThan(present(weak.score));
    const hierarchyProblem = run({
      body: [
        prose[0],
        paragraph("Water and drainage", "h4"),
        ...prose.slice(1),
      ],
    });
    expect(rule(hierarchyProblem, "seo.headings").status).toBe("improve");
    expect(hierarchyProblem.score).toBeLessThan(present(structured.score));
  });
  it("rewards useful internal linking without rewarding repeated links or external quotas", () => {
    const improvement = [
      linked(present(present(prose[0]).children[0]).text, "/watering"),
      ...prose.slice(1),
    ];
    expect(run({ body: improvement }).score).toBeGreaterThan(
      present(run().score),
    );
    const repeated = structuredClone(improvement);
    present(present(repeated[0]).children[0]).marks.push("same-target");
    present(repeated[0]).markDefs.push({
      _key: "same-target",
      _type: "link",
      href: "/watering",
    });
    expect(run({ body: repeated }).score).toBe(
      run({ body: improvement }).score,
    );
    expect(
      run({
        body: [
          linked(
            present(present(prose[0]).children[0]).text,
            "https://reference.test",
          ),
          ...prose.slice(1),
        ],
      }).score,
    ).toBe(run().score);
    expect(run({ body: [linked("Hello.", "/watering")] }).score).toBe(
      run({ body: [paragraph("Hello.")] }).score,
    );
  });
  it("handles longer structured prose without awarding length points", () => {
    const structured = [
      paragraph("Check soil", "h2"),
      linked(present(present(prose[0]).children[0]).text, "/watering"),
      paragraph("Drainage", "h2"),
      prose[1],
      paragraph("Sunlight", "h2"),
      prose[2],
    ];
    const longer = [...structured, paragraph("Seasonal care", "h2"), ...prose];
    expect(run({ body: structured }).score).toBeGreaterThan(
      present(run().score),
    );
    expect(run({ body: longer }).score).toBe(run({ body: structured }).score);
  });
  it("list items do not trigger the multi-paragraph heuristic", () => {
    expect(
      rule(
        run({ body: prose.map((p) => ({ ...p, listItem: "bullet" })) }),
        "seo.sections",
      ).status,
    ).toBe("unsupported");
  });
  it("does not inflate scores with absent or properly described optional images", () => {
    const absent = run(),
      withImage = run({
        body: [
          ...prose,
          { _type: "image", alt: "Soil beneath a balcony plant" },
        ],
      });
    expect(rule(absent, "seo.image-alt").status).toBe("unsupported");
    expect(rule(withImage, "seo.image-alt").status).toBe("good");
    expect(withImage.score).toBe(absent.score);
    const bad = run({ body: [...prose, { _type: "image" }] });
    expect(bad.score).toBeLessThan(present(withImage.score));
    expect(
      run({ body: [...prose, { _type: "image", decorative: true }] }).score,
    ).toBe(absent.score);
  });
  it("checks phrase locations without penalizing synonyms or incentivizing stuffing", () => {
    const original = analyze(checkout);
    const withPhrase = analyze({
      ...checkout,
      keyphrases: ["woocommerce checkout"],
    });
    expect(withPhrase.score).toBe(original.score);
    for (const field of ["title", "description", "introduction", "body", "url"])
      expect(rule(withPhrase, `keyword.0.${field}`).status).toBe("good");
    expect(rule(withPhrase, "keyword.0.headings").status).toBe("unsupported");
    expect(
      analyze({
        ...checkout,
        keyphrases: ["checkout usability", "purchase process"],
      }).score,
    ).toBe(original.score);
    expect(
      analyze({
        ...checkout,
        body: [
          ...(checkout.body as unknown[]),
          paragraph("woocommerce checkout ".repeat(50)),
        ],
        keyphrases: ["woocommerce checkout"],
      }).score,
    ).toBe(original.score);
  });
  it("distinguishes saved metadata, excerpt previews and unattested draft metadata", () => {
    const saved = run(),
      excerpt = run({ descriptionSource: "excerpt" });
    expect(rule(excerpt, "seo.description").status).toBe("improve");
    expect(excerpt.score).toBeLessThan(present(saved.score));
    expect(
      rule(run({ descriptionSource: "draft" }), "seo.description"),
    ).toMatchObject({ status: "unsupported", reason: "unavailable" });
    expect(
      rule(run({ titleSource: "content" }), "seo.title").message,
    ).toContain("fallback");
  });
  it("does not pass structure and image checks when custom blocks are unobservable", () => {
    const a = run({ body: [...prose, { _type: "customArticle" }] });
    for (const id of [
      "seo.body",
      "seo.sections",
      "seo.headings",
      "seo.image-alt",
      "seo.internal-links",
    ])
      expect(rule(a, id)).toMatchObject({
        status: "unsupported",
        reason: "unavailable",
      });
    expect(a.assessment.unavailable).toBeGreaterThan(0);
    expect(JSON.stringify(analysisBlocks(a))).toContain("Partial analysis");
    expect(JSON.stringify(analysisBlocks(a))).toContain("Unavailable:");
  });
  it("excludes unavailable rules and applies optional deductions without dilution", () => {
    const good: Check = {
      id: "title",
      category: "seo",
      status: "good",
      weight: 2,
      message: "",
    };
    const bad: Check = { ...good, id: "body", weight: 4, status: "problem" };
    expect(score([good, bad])).toBe(33);
    expect(
      score([good, bad, { ...good, status: "unsupported", weight: 100 }]),
    ).toBe(33);
    expect(score([good, bad, { ...good, weight: 0, deduction: 5 }])).toBe(33);
    expect(
      score([
        good,
        bad,
        { ...good, weight: 0, deduction: 5, status: "improve" },
      ]),
    ).toBe(28);
    expect(score([{ ...good, status: "unsupported" }])).toBeNull();
    expect(
      score([bad, { ...good, weight: 0, deduction: 10, status: "problem" }]),
    ).toBe(0);
  });
  it("keeps English linguistic scores separate and marks non-English limits", () => {
    const english = run(),
      french = run({
        locale: "fr",
        body: [
          paragraph(
            "Arrosez les plantes lorsque la terre est sèche. Choisissez un pot avec des trous pour évacuer l’eau.",
          ),
        ],
      });
    expect(french.readingEase).toBeNull();
    expect(rule(french, "readability.language")).toMatchObject({
      status: "unsupported",
      reason: "unavailable",
    });
    expect(french.assessment.unavailable).toBeGreaterThan(0);
    expect(run({ locale: "fr" }).score).toBe(english.score);
    expect(run({ readability: false }).score).toBe(english.score);
    expect(run({ language: "structural" }).readingEase).toBeNull();
    expect(run({ locale: "fr", language: "en" }).readingEase).not.toBeNull();
  });
  it("flags unsafe links and truncation without rewarding their absence", () => {
    expect(
      run({
        body: [
          linked(
            present(present(prose[0]).children[0]).text,
            "javascript:alert(1)",
          ),
          ...prose.slice(1),
        ],
      }).score,
    ).toBeLessThan(present(run().score));
    expect(
      run({ title: "A useful but very long title ".repeat(4) }).score,
    ).toBeLessThan(present(run().score));
    expect(
      run({ description: "A very long preview summary. ".repeat(10) }).score,
    ).toBeLessThan(present(run().score));
  });
  it("does not judge Japanese prose using English-like word segmentation", () => {
    const a = run({
      locale: "ja",
      body: [
        paragraph(
          "土が乾いたら植物に水を与えてください。水はけの良い鉢を選び、日当たりを確認してください。",
        ),
      ],
      keyphrases: ["植物"],
    });
    expect(rule(a, "seo.body").status).toBe("good");
    expect(a.readabilityScore).toBeNull();
    expect(rule(a, "keyword.0.body")).toMatchObject({
      status: "unsupported",
      reason: "unavailable",
    });
    expect(JSON.stringify(a.checks)).toContain("word segmentation");
  });
});

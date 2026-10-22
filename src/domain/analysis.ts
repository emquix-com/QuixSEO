import type { Document } from "./content.js";
import {
  classifyLinks,
  extractDocument,
  hasPhrase,
  normalize,
  words,
} from "./content.js";
import { analysisUrls } from "./urls.js";

export interface Check {
  id: string;
  status: "good" | "improve" | "problem" | "unsupported";
  message: string;
  weight: number;
  deduction?: number;
  reason?: "unavailable" | "not-applicable";
  category: "seo" | "readability";
}
export interface AnalysisInput {
  title: string;
  description: string;
  url?: string | null;
  siteUrl?: string | null;
  titleSource?: "saved" | "content" | "draft";
  descriptionSource?: "saved" | "excerpt" | "draft" | "missing";
  body: unknown;
  keyphrases: string[];
  locale: string;
  readability: boolean;
  language: "auto" | "en" | "structural";
}
export interface Analysis {
  score: number | null;
  readabilityScore: number | null;
  checks: Check[];
  wordCount: number;
  internal: string[];
  external: string[];
  missingAlt: number;
  readingEase: number | null;
  coverage: string[];
  modelVersion: 2;
  linksAssessed: boolean;
  assessment: { assessed: number; unavailable: number; notApplicable: number };
}
export function score(checks: Check[]): number | null {
  const applicable = checks.filter(
    (c) => c.status !== "unsupported" && c.weight > 0,
  );
  const total = applicable.reduce((s, c) => s + c.weight, 0);
  return total
    ? Math.max(
        0,
        Math.round(
          (100 *
            applicable.reduce(
              (s, c) =>
                s +
                c.weight *
                  (c.status === "good" ? 1 : c.status === "improve" ? 0.5 : 0),
              0,
            )) /
            total -
            checks.reduce(
              (sum, c) =>
                sum +
                (c.status === "improve" || c.status === "problem"
                  ? (c.deduction ?? 0)
                  : 0),
              0,
            ),
        ),
      )
    : null;
}
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, "");
  return Math.max(1, (w.match(/[aeiouy]+/gu) ?? []).length);
}
export function readingEase(text: string): number | null {
  const tokens = words(text);
  const sentences = text
    .split(/[.!?]+(?:\s|$)/u)
    .filter((s) => words(s).length);
  if (!tokens.length || !sentences.length) return null;
  return (
    Math.round(
      10 *
        (206.835 -
          (1.015 * tokens.length) / sentences.length -
          (84.6 * tokens.reduce((s, w) => s + syllables(w), 0)) /
            tokens.length),
    ) / 10
  );
}
function readability(
  doc: Document,
  english: boolean,
): { checks: Check[]; ease: number | null } {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, good: string, bad: string) =>
    checks.push({
      id,
      status: ok ? "good" : "improve",
      message: ok ? good : bad,
      weight: 1,
      category: "readability",
    });
  if (!doc.paragraphs.some((p) => p.trim()))
    return {
      checks: [
        {
          id: "readability.empty",
          status: "unsupported",
          message: "Add text before analyzing readability.",
          weight: 0,
          category: "readability",
          reason: "not-applicable",
        },
      ],
      ease: null,
    };
  add(
    "readability.paragraphs",
    doc.paragraphs.every((p) => words(p).length <= 120),
    "Paragraphs are easy to scan.",
    "Consider splitting paragraphs longer than 120 words where the idea changes.",
  );
  add(
    "readability.sections",
    doc.sections.every((p) => words(p).length <= 300),
    "Sections have manageable length.",
    "A section exceeds 300 words. Add a useful subheading if it improves navigation.",
  );
  if (!english) {
    checks.push({
      id: "readability.language",
      status: "unsupported",
      message:
        "Sentence, transition, repetition and reading-ease rules currently support English only. Structural checks remain available.",
      weight: 0,
      category: "readability",
      reason: "unavailable",
    });
    return { checks, ease: null };
  }
  const sentences = doc.paragraphs
    .join(" ")
    .split(/[.!?]+(?:\s|$)/u)
    .filter((s) => words(s).length);
  add(
    "readability.sentences",
    sentences.length === 0 ||
      sentences.filter((s) => words(s).length > 25).length / sentences.length <=
        0.25,
    "Most sentences are concise.",
    "More than a quarter of sentences exceed 25 words. Consider simplifying the hardest ones.",
  );
  const starts = sentences.map((s) =>
    normalize(s).split(" ").slice(0, 2).join(" "),
  );
  if (sentences.length >= 3)
    add(
      "readability.repetition",
      !starts.some(
        (s, i) => i > 1 && s === starts[i - 1] && s === starts[i - 2],
      ),
      "Sentence openings are varied.",
      "Three consecutive sentences start with the same two words. Vary them if the repetition is unintended.",
    );
  else
    checks.push({
      id: "readability.repetition",
      status: "unsupported",
      message:
        "At least three sentences are needed to assess consecutive repeated openings.",
      weight: 0,
      category: "readability",
      reason: "not-applicable",
    });
  if (sentences.length >= 5)
    add(
      "readability.transitions",
      sentences.some((s) =>
        /\b(however|therefore|because|although|for example|in addition|instead|finally|meanwhile)\b/iu.test(
          s,
        ),
      ),
      "A recognized transition expression is present. Check that the connections between ideas make sense.",
      "Consider clarifying how ideas connect, for example with ‘because’ or ‘however’, where appropriate.",
    );
  else
    checks.push({
      id: "readability.transitions",
      status: "unsupported",
      message: "This short passage does not need a transition-word checklist.",
      weight: 0,
      category: "readability",
      reason: "not-applicable",
    });
  // A tiny vocabulary cannot reliably grade how ideas connect.
  const transition = checks.find((c) => c.id === "readability.transitions");
  if (transition) transition.weight = 0;
  const enoughText = words(doc.paragraphs.join(" ")).length >= 20;
  const ease = enoughText ? readingEase(doc.paragraphs.join(" ")) : null;
  if (ease !== null)
    add(
      "readability.ease",
      ease >= 50,
      "Estimated English reading ease is at least 50.",
      "Estimated English reading ease is below 50. Review complex sentences for your audience; specialist terms may be necessary.",
    );
  else
    checks.push({
      id: "readability.ease",
      status: "unsupported",
      message:
        "Fewer than 20 readable words: too little text for a stable reading-ease estimate. This is a measurement limit, not a minimum content length.",
      weight: 0,
      category: "readability",
      reason: "unavailable",
    });
  return { checks, ease };
}
export function analyze(input: AnalysisInput): Analysis {
  const doc = extractDocument(input.body);
  const urls = analysisUrls(input.siteUrl, input.url);
  const links = classifyLinks(doc.links, urls.page, urls.site);
  const complete = doc.unsupported.length === 0;
  const structured = complete && doc.structureKnown;
  const prose = doc.paragraphs.filter((p) => p.trim()).join(" ");
  const wordCount = words(doc.text).length;
  const wordSegmentationSupported = !/^(?:zh|ja|th|lo|km|my)(?:-|$)/iu.test(
    input.locale,
  );
  const hasBody = Boolean(prose.trim());
  const multiParagraph = doc.proseParagraphs >= 3;
  const checks: Check[] = [];
  const add = (
    id: string,
    status: Check["status"],
    message: string,
    weight = 0,
    deduction = 0,
  ) => {
    checks.push({ id, status, message, weight, deduction, category: "seo" });
  };
  const na = (
    id: string,
    message: string,
    reason: Check["reason"] = "not-applicable",
    weight = 0,
  ) => {
    checks.push({
      id,
      status: "unsupported",
      message,
      weight,
      category: "seo",
      reason,
    });
  };
  const diagnostic = (
    id: string,
    ok: boolean,
    good: string,
    bad: string,
    deduction: number,
    severe = false,
  ) =>
    add(
      id,
      ok ? "good" : severe ? "problem" : "improve",
      ok ? good : bad,
      0,
      deduction,
    );

  add(
    "seo.title",
    input.title.trim() ? "good" : "problem",
    input.title.trim()
      ? input.titleSource === "content"
        ? "A content title is available as a fallback. Verify the title shown by your theme."
        : "A title is available. Make sure it clearly describes this page."
      : "Add a descriptive title so readers know what this page is about.",
    2,
  );
  if (input.descriptionSource === "draft")
    na(
      "seo.description",
      "This snapshot contains an excerpt, not saved SEO metadata. Check the saved description in the SEO panel.",
      "unavailable",
      2,
    );
  else
    add(
      "seo.description",
      !input.description.trim()
        ? "problem"
        : input.descriptionSource === "excerpt"
          ? "improve"
          : "good",
      !input.description.trim()
        ? "Write a useful meta description in EmDash’s SEO panel."
        : input.descriptionSource === "excerpt"
          ? "The preview uses the excerpt; no explicit SEO description is saved. Confirm your theme uses this excerpt or save a description in EmDash’s SEO panel."
          : "An SEO description is saved. Check that it accurately summarizes this page.",
      2,
    );
  if (input.title.trim())
    diagnostic(
      "seo.title-width",
      [...input.title].length <= 65,
      "The title is within the approximate 65-character preview guideline.",
      "Review this title for truncation: it exceeds the approximate 65-character guideline.",
      3,
    );
  else
    na("seo.title-width", "Add a title before assessing its preview length.");
  if (input.description.trim() && input.descriptionSource !== "draft")
    diagnostic(
      "seo.description-width",
      [...input.description].length <= 170,
      "The description is within the approximate 170-character preview guideline.",
      "Review this description for truncation: it exceeds the approximate 170-character guideline.",
      2,
    );
  else
    na(
      "seo.description-width",
      "No saved description or excerpt is available to assess its preview length.",
    );

  if (!complete)
    na(
      "seo.body",
      "Some body content cannot be read. Review the complete page before judging its content.",
      "unavailable",
      4,
    );
  else {
    // A review trigger for a fragment, not a minimum article length or ranking rule.
    const fragment =
      wordSegmentationSupported &&
      words(prose).length < 20 &&
      prose.split(/[.!?。！？]+/u).filter((s) => s.trim()).length < 2;
    add(
      "seo.body",
      !hasBody ? "problem" : fragment ? "improve" : "good",
      !hasBody
        ? "Add readable content that answers the reader’s question; headings alone are not an answer."
        : fragment
          ? "This is a very brief statement. Check whether it gives the reader a complete answer; expand only if useful."
          : "Readable prose is present. Its accuracy and usefulness still need your editorial judgment.",
      4,
    );
  }
  if (!structured)
    na(
      "seo.sections",
      "Useful sectioning cannot be fully assessed in this body format.",
      "unavailable",
      3,
    );
  else if (!hasBody || !multiParagraph)
    na(
      "seo.sections",
      "This concise passage or list does not automatically need subheadings.",
    );
  else
    add(
      "seo.sections",
      doc.headings.some((h) => h.level >= 2 && h.text.trim())
        ? "good"
        : "improve",
      doc.headings.some((h) => h.level >= 2 && h.text.trim())
        ? "Subheadings are present. Check that they identify useful sections rather than repeat the title."
        : "Several prose paragraphs have no subheadings. Group distinct ideas under useful headings if that helps readers scan the page.",
      3,
    );
  if (!structured)
    na(
      "seo.headings",
      "Heading hierarchy cannot be fully assessed in this body format.",
      "unavailable",
    );
  else if (!doc.headings.length)
    na(
      "seo.headings",
      "There are no body headings to check for hierarchy. Sectioning is assessed separately.",
    );
  else
    diagnostic(
      "seo.headings",
      doc.headings.filter((h) => h.level === 1).length <= 1 &&
        !doc.headings.some(
          (h, i) =>
            h.level > (doc.headings[i - 1]?.level ?? 1) + 1 || !h.text.trim(),
        ),
      "Body headings have no detected level skips, empty headings or repeated H1s. Verify the theme’s page heading separately.",
      "Use meaningful headings without skipped levels, empty labels or multiple body H1s; the theme usually supplies the page H1.",
      5,
    );

  const linksAssessed = structured && links.classified;
  if (!linksAssessed)
    na(
      "seo.internal-links",
      "Internal links are not fully assessed. A usable Site URL or public content URL and supported body blocks are needed; page-relative links also need the actual content URL.",
      "unavailable",
      3,
    );
  else if (!hasBody || (!multiParagraph && !links.internal.length))
    na(
      "seo.internal-links",
      "No contextual internal link is required for every concise answer or utility page. Add one only if it helps the reader.",
    );
  else
    add(
      "seo.internal-links",
      links.internal.length ? "good" : "improve",
      links.internal.length
        ? "Links to other pages on this site are present. Check that their targets and anchor text help the reader."
        : "Consider linking to a relevant explanation, service or next step on this site. Skip links that would be unnatural.",
      multiParagraph ? 3 : 0,
    );
  if (!linksAssessed)
    na(
      "seo.external-links",
      "External link classification is unavailable for some or all links.",
      "unavailable",
    );
  else if (!links.external.length)
    na(
      "seo.external-links",
      "No external links. Cite sources when useful; there is no link quota.",
    );
  else
    add(
      "seo.external-links",
      "good",
      `${links.external.length} external links found. Check whether citations support your claims; destinations have not been fetched.`,
    );
  const missingAlt = doc.images.filter((i) => !i.alt && !i.decorative).length;
  if (missingAlt)
    diagnostic(
      "seo.image-alt",
      false,
      "",
      "Add meaningful alt text to informative images, or explicitly mark purely decorative images.",
      5,
    );
  else if (!structured)
    na(
      "seo.image-alt",
      "Images cannot be fully inspected in this body format.",
      "unavailable",
    );
  else if (!doc.images.length)
    na(
      "seo.image-alt",
      "No images to assess. Add images only when they help explain the content.",
    );
  else
    diagnostic(
      "seo.image-alt",
      true,
      "All observed images have alt text or are explicitly decorative. Check that the descriptions are meaningful.",
      "",
      5,
    );
  if (links.invalid.length)
    diagnostic(
      "seo.invalid-links",
      false,
      "",
      "Repair links with malformed or unsafe URLs. This check does not test whether destinations respond.",
      10,
      true,
    );
  else if (!structured || links.unresolved.length)
    na(
      "seo.invalid-links",
      "Not all link URLs can be assessed from the available content and URL context.",
      "unavailable",
    );
  else if (!doc.links.length)
    na("seo.invalid-links", "No body links to validate.");
  else
    diagnostic(
      "seo.invalid-links",
      true,
      "Observed link URLs have safe syntax. Destination availability has not been checked.",
      "",
      10,
    );

  na(
    "seo.depth",
    wordSegmentationSupported && multiParagraph && wordCount < 250
      ? "This is a short multi-paragraph piece. Check that it delivers on the title with concrete advice, examples or evidence where useful. There is no required word count; topical depth needs human review."
      : "Check that this page answers the reader’s question accurately and completely. Topical depth cannot be established by word count or this checklist.",
  );
  if (!input.keyphrases.length)
    na(
      "keyword.none",
      "No focus keyphrase is set. Topic-placement guidance is optional and does not affect the score.",
    );
  for (const [i, phrase] of input.keyphrases.entries()) {
    const fields: Record<string, string | null> = {
      title: input.title,
      description: input.description || null,
      url: urls.page ? readablePath(urls.page) : null,
      headings: doc.headings.length
        ? doc.headings.map((h) => h.text).join(" ")
        : null,
      introduction: doc.paragraphs[0] || null,
      body: doc.text || null,
    };
    for (const [field, value] of Object.entries(fields)) {
      const bodyField = ["headings", "introduction", "body"].includes(field);
      if (!wordSegmentationSupported) {
        na(
          `keyword.${i}.${field}`,
          `“${phrase}” in ${field}: word segmentation for this language is not supported. Review topic wording manually.`,
          "unavailable",
        );
      } else if (value === null || (bodyField && !complete)) {
        na(
          `keyword.${i}.${field}`,
          `“${phrase}” in ${field}: not assessed because ${field === "url" ? "no usable public content URL is available" : "this field is absent or incompletely readable"}.`,
          field === "url" || (bodyField && !complete)
            ? "unavailable"
            : "not-applicable",
        );
      } else
        add(
          `keyword.${i}.${field}`,
          hasPhrase(value, phrase) ? "good" : "improve",
          hasPhrase(value, phrase)
            ? `“${phrase}” appears in the ${field}. No repetition is needed; this guidance is unscored.`
            : `Consider whether “${phrase}” belongs naturally in the ${field}. Synonyms may be better; exact wording is optional and unscored.`,
        );
    }
  }
  if (!urls.page)
    na(
      "seo.public-url",
      "No usable public content URL is available. Public path and canonical comparisons are not assessed; drafts may not have a public route.",
      "unavailable",
    );
  else
    add(
      "seo.public-url",
      "good",
      "EmDash supplied a usable content URL. Its destination has not been fetched.",
    );
  const r =
    input.readability && complete && wordSegmentationSupported
      ? readability(
          doc,
          input.language === "en" ||
            (input.language === "auto" && /^en(?:-|$)/iu.test(input.locale)),
        )
      : {
          checks: [
            {
              id: "readability.unavailable",
              status: "unsupported" as const,
              message: input.readability
                ? !wordSegmentationSupported
                  ? "Readability and word-length guidelines are not assessed because word segmentation for this language is not supported."
                  : "Readability is not assessed because some content could not be read."
                : "Readability is disabled in QuixSEO Settings.",
              weight: 0,
              category: "readability" as const,
              reason: "unavailable" as const,
            },
          ],
          ease: null,
        };
  const allChecks = [...checks, ...r.checks];
  const coverage = [...doc.unsupported];
  if (!urls.origin)
    coverage.push(
      "No usable Site URL or public content URL: link classification is unavailable.",
    );
  if (!urls.page)
    coverage.push(
      "No usable public content URL: public path and canonical comparisons are unavailable.",
    );
  if (links.unresolved.length)
    coverage.push(
      `${links.unresolved.length} link targets could not be resolved or classified.`,
    );
  if (!doc.structureKnown)
    coverage.push(
      "Body structure, links and images require supported Portable Text blocks.",
    );
  if (
    r.checks.some(
      (c) => c.status === "unsupported" && c.reason === "unavailable",
    )
  )
    coverage.push(
      "Some readability checks are unavailable; see the individual explanations.",
    );
  return {
    modelVersion: 2,
    score: score(checks),
    readabilityScore: words(prose).length >= 20 ? score(r.checks) : null,
    checks: allChecks,
    wordCount,
    internal: links.internal,
    external: links.external,
    linksAssessed,
    missingAlt,
    readingEase: r.ease,
    coverage,
    assessment: {
      assessed: allChecks.filter((c) => c.status !== "unsupported").length,
      unavailable: allChecks.filter(
        (c) => c.status === "unsupported" && c.reason === "unavailable",
      ).length,
      notApplicable: allChecks.filter(
        (c) => c.status === "unsupported" && c.reason !== "unavailable",
      ).length,
    },
  };
}

function readablePath(url: string): string {
  const path = new URL(url).pathname;
  try {
    return decodeURI(path).replace(/[-_]/gu, " ");
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
    return path.replace(/[-_]/gu, " ");
  }
}

import type { Document } from "./content.js";
import {
  classifyLinks,
  extractDocument,
  hasPhrase,
  normalize,
  words,
} from "./content.js";
export interface Check {
  id: string;
  status: "good" | "improve" | "problem" | "unsupported";
  message: string;
  weight: number;
  category: "seo" | "readability";
}
export interface AnalysisInput {
  title: string;
  description: string;
  url: string;
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
}
export function score(checks: Check[]): number | null {
  const applicable = checks.filter(
    (c) => c.status !== "unsupported" && c.weight > 0,
  );
  const total = applicable.reduce((s, c) => s + c.weight, 0);
  return total
    ? Math.round(
        (100 *
          applicable.reduce(
            (s, c) =>
              s +
              c.weight *
                (c.status === "good" ? 1 : c.status === "improve" ? 0.5 : 0),
            0,
          )) /
          total,
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
  if (!doc.text.trim())
    return {
      checks: [
        {
          id: "readability.empty",
          status: "unsupported",
          message: "Add text before analyzing readability.",
          weight: 0,
          category: "readability",
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
  add(
    "readability.repetition",
    !starts.some((s, i) => i > 1 && s === starts[i - 1] && s === starts[i - 2]),
    "Sentence openings are varied.",
    "Three consecutive sentences start with the same two words. Vary them if the repetition is unintended.",
  );
  add(
    "readability.transitions",
    sentences.length < 5 ||
      sentences.some((s) =>
        /\b(however|therefore|because|although|for example|in addition|instead|finally|meanwhile)\b/iu.test(
          s,
        ),
      ),
    "Connections between ideas are present or the passage is short.",
    "Consider clarifying how ideas connect, for example with ‘because’ or ‘however’, where appropriate.",
  );
  const ease = readingEase(doc.text);
  add(
    "readability.ease",
    ease === null || ease >= 50,
    "Estimated English reading ease is at least 50.",
    "Estimated English reading ease is below 50. Review complex sentences for your audience; specialist terms may be necessary.",
  );
  return { checks, ease };
}
export function analyze(input: AnalysisInput): Analysis {
  const doc = extractDocument(input.body);
  const links = classifyLinks(doc.links, input.url);
  const checks: Check[] = [];
  const add = (
    id: string,
    ok: boolean,
    message: string,
    weight = 1,
    severe = false,
  ) =>
    checks.push({
      id,
      status: ok ? "good" : severe ? "problem" : "improve",
      message: ok ? `${message} — checked.` : message,
      weight,
      category: "seo",
    });
  add(
    "seo.title",
    Boolean(input.title.trim()),
    "Give this page a descriptive SEO title",
    3,
    true,
  );
  add(
    "seo.description",
    Boolean(input.description.trim()),
    "Write a useful summary for the meta description",
    2,
    true,
  );
  add(
    "seo.title-width",
    [...input.title].length <= 65,
    "Review titles over 65 characters for likely truncation; this is a guideline",
  );
  add(
    "seo.description-width",
    [...input.description].length <= 170,
    "Review descriptions over 170 characters for likely truncation; this is a guideline",
  );
  add(
    "seo.body",
    Boolean(doc.text.trim()),
    "Provide readable page content",
    2,
    true,
  );
  add(
    "seo.headings",
    doc.headings.filter((h) => h.level === 1).length <= 1 &&
      !doc.headings.some(
        (h, i) => i > 0 && h.level > (doc.headings[i - 1]?.level ?? 1) + 1,
      ),
    "Use a logical heading hierarchy without multiple body H1 headings",
  );
  add(
    "seo.internal-links",
    links.internal.length > 0,
    "Link to a relevant page on this site when it helps the reader",
  );
  checks.push({
    id: "seo.external-links",
    status: "good",
    message: `${links.external.length} external links. Add citations when useful; external links are not a quota.`,
    weight: 0,
    category: "seo",
  });
  const missingAlt = doc.images.filter((i) => !i.alt && !i.decorative).length;
  add(
    "seo.image-alt",
    missingAlt === 0,
    "Describe informative images with meaningful alt text; mark decorative images explicitly",
    2,
  );
  add(
    "seo.invalid-links",
    links.invalid.length === 0,
    "Repair links with invalid or unsafe URLs",
    2,
    true,
  );
  if (!input.keyphrases.length)
    checks.push({
      id: "keyword.none",
      status: "unsupported",
      message:
        "Set an optional focus keyphrase to check how clearly this page expresses its topic.",
      weight: 0,
      category: "seo",
    });
  for (const [i, phrase] of input.keyphrases.entries()) {
    const fields = {
      title: input.title,
      description: input.description,
      url: readablePath(input.url),
      headings: doc.headings.map((h) => h.text).join(" "),
      introduction: doc.paragraphs[0] ?? "",
      body: doc.text,
    };
    for (const [field, value] of Object.entries(fields))
      add(
        `keyword.${i}.${field}`,
        hasPhrase(value, phrase),
        `Consider whether “${phrase}” belongs naturally in the ${field}; exact wording is optional`,
        0.5,
      );
  }
  const r = input.readability
    ? readability(
        doc,
        input.language === "en" ||
          (input.language === "auto" && /^en(?:-|$)/iu.test(input.locale)),
      )
    : { checks: [], ease: null };
  return {
    score: score(checks),
    readabilityScore: score(r.checks),
    checks: [...checks, ...r.checks],
    wordCount: words(doc.text).length,
    internal: links.internal,
    external: links.external,
    missingAlt,
    readingEase: r.ease,
    coverage: doc.unsupported,
  };
}

function readablePath(url: string): string {
  const path = new URL(url).pathname;
  try {
    return decodeURI(path).replace(/[-_]/gu, " ");
  } catch {
    return path.replace(/[-_]/gu, " ");
  }
}

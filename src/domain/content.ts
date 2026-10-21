export interface Document {
  text: string;
  paragraphs: string[];
  headings: { level: number; text: string }[];
  sections: string[];
  links: string[];
  images: { alt: string; decorative: boolean }[];
  unsupported: string[];
}
export const words = (s: string): string[] =>
  s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
export const normalize = (s: string): string =>
  words(s.normalize("NFKC").toLocaleLowerCase()).join(" ");
export function hasPhrase(text: string, phrase: string): boolean {
  const p = normalize(phrase);
  return Boolean(p) && ` ${normalize(text)} `.includes(` ${p} `);
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function extractDocument(body: unknown): Document {
  const doc: Document = {
    text: "",
    paragraphs: [],
    headings: [],
    sections: [],
    links: [],
    images: [],
    unsupported: [],
  };
  if (typeof body === "string") {
    if (body.length > 200000)
      throw new Error("Body exceeds the 200,000 character analysis budget");
    // Plain-text fields are supported; HTML is not silently treated as rendered content.
    if (/<\/?[a-z][^>]*>/iu.test(body))
      doc.unsupported.push(
        "HTML field: use Portable Text for structure and link checks",
      );
    doc.paragraphs = body.split(/\n\s*\n/u).filter(Boolean);
    doc.sections = [body];
    doc.text = body;
    return doc;
  }
  if (!Array.isArray(body)) {
    doc.unsupported.push("No supported body field");
    return doc;
  }
  if (body.length > 5000)
    throw new Error("Body exceeds the 5,000 block analysis budget");
  let section: string[] = [];
  let chars = 0;
  for (const raw of body) {
    const block = record(raw);
    const type = String(block._type ?? "unknown");
    if (type === "block") {
      const children = Array.isArray(block.children) ? block.children : [];
      const text = children
        .map((c) => {
          const span = record(c);
          return typeof span.text === "string" ? span.text : "";
        })
        .join("");
      chars += text.length;
      if (chars > 200000)
        throw new Error("Body exceeds the 200,000 character analysis budget");
      const style = String(block.style ?? "normal");
      if (/^h[1-6]$/u.test(style)) {
        if (section.length) doc.sections.push(section.join(" "));
        section = [];
        doc.headings.push({ level: Number(style[1]), text });
      } else {
        doc.paragraphs.push(text);
        section.push(text);
      }
      const used = new Set(
        children.flatMap((c) => {
          const marks = record(c).marks;
          return Array.isArray(marks) ? marks : [];
        }),
      );
      for (const rawMark of Array.isArray(block.markDefs)
        ? block.markDefs
        : []) {
        const mark = record(rawMark);
        if (used.has(mark._key) && typeof mark.href === "string")
          doc.links.push(mark.href);
      }
    } else if (type === "image") {
      doc.images.push({
        alt: typeof block.alt === "string" ? block.alt.trim() : "",
        decorative: block.decorative === true,
      });
    } else doc.unsupported.push(type);
  }
  if (section.length) doc.sections.push(section.join(" "));
  doc.text = [...doc.paragraphs, ...doc.headings.map((h) => h.text)].join("\n");
  doc.unsupported = [...new Set(doc.unsupported)];
  return doc;
}
export function classifyLinks(
  links: string[],
  pageUrl: string,
): { internal: string[]; external: string[]; invalid: string[] } {
  const result = {
    internal: [] as string[],
    external: [] as string[],
    invalid: [] as string[],
  };
  const base = new URL(pageUrl);
  for (const href of links) {
    if (/^(?:#|mailto:|tel:)/iu.test(href)) continue;
    try {
      if (/[\u0000-\u0020\\]/u.test(href)) throw new Error("Invalid link");
      const url = new URL(href, base);
      const target = url.href.replace(/#.*$/u, "");
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Invalid link");
      if (target === base.href.replace(/#.*$/u, "")) continue;
      result[url.origin === base.origin ? "internal" : "external"].push(target);
    } catch {
      result.invalid.push(href);
    }
  }
  return result;
}

import { z } from "#validation";
import { identifier, text } from "./validation.js";

export const llmsConfigSchema = z.strictObject({
  enabled: z._default(z.boolean(), false),
  summary: z._default(text(1000), ""),
  collections: z._default(z.array(identifier).check(z.maxLength(100)), []),
});
export type LlmsConfig = z.infer<typeof llmsConfigSchema>;
export interface LlmsLink {
  title: string;
  url: string;
  collection: string;
}
export const LLMS_ENTRY_LIMIT = 50;
export const LLMS_COLLECTION_LIMIT = 20;
export const LLMS_BYTE_LIMIT = 48000;

/** Escape inline text so a content title cannot insert Markdown or HTML markup. */
export function markdownText(value: string, max = 200): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/[\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, max)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/[\\`*_[\]{}()#!|]/gu, "\\$&");
}
export function renderLlms(name: string, summary: string, links: LlmsLink[]) {
  const lines = [`# ${markdownText(name) || "Website"}`, ""];
  if (summary) lines.push(`> ${markdownText(summary, 1000)}`, "");
  lines.push(
    "Selected published pages. This guide is not a complete sitemap.",
    "",
  );
  let group = "",
    included = 0;
  let truncated = false;
  for (const link of links) {
    const heading =
      link.collection !== group
        ? `## ${markdownText(link.collection)}\n\n`
        : "";
    // Percent-encode Markdown destination delimiters; do not change URL semantics.
    const url = link.url.replace(
      /[()<>]/gu,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const line = `${heading}- [${markdownText(link.title) || "Page"}](${url})\n`;
    if (
      new TextEncoder().encode(`${lines.join("\n")}\n${line}`).length >
      LLMS_BYTE_LIMIT
    ) {
      truncated = true;
      break;
    }
    lines.push(line);
    group = link.collection;
    included++;
  }
  return { text: `${lines.join("\n").trimEnd()}\n`, included, truncated };
}

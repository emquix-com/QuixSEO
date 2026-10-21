import { z } from "zod";

export const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v),
      "Control characters are not allowed",
    );
export function httpUrl(input: string): string {
  if (/[\s\\]/u.test(input))
    throw new Error(
      "Use an absolute HTTP(S) URL without whitespace or backslashes",
    );
  const url = new URL(input);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP(S) URL without credentials");
  return url.href;
}
export const urlField = text(2048).refine((v) => {
  try {
    if (v) httpUrl(v);
    return true;
  } catch {
    return false;
  }
}, "Use an absolute HTTP(S) URL");
export function canonicalUrl(input: string): string {
  // Legacy workerd URL setters can retain a trailing # for hash="".
  return httpUrl(input).replace(/#.*$/u, "");
}
// Native fields may contain core media IDs or relative paths. Preserve them in
// snapshots; plugin-owned social/schema URLs still require absolute HTTP(S).
export const nativeReference = text(2048).refine((v) => {
  if (!v) return true;
  if (/[\s\\]/u.test(v)) return false;
  try {
    httpUrl(new URL(v, "https://quixseo.invalid/").href);
    return true;
  } catch {
    return false;
  }
}, "Use an HTTP(S) URL, a safe relative path or a core media ID");
export const seoSchema = z
  .object({
    title: text(300).nullable(),
    description: text(1000).nullable(),
    canonical: nativeReference.nullable(),
    image: nativeReference.nullable(),
    noIndex: z.boolean(),
  })
  .strict();
export type Seo = z.infer<typeof seoSchema>;
export const emptySeo: Seo = {
  title: null,
  description: null,
  canonical: null,
  image: null,
  noIndex: false,
};
export const identitySchema = z
  .object({
    type: z.enum(["Organization", "Person"]),
    name: text(160),
    url: urlField,
    logo: urlField,
  })
  .strict();
export const schemaTypes = [
  "WebPage",
  "Article",
  "BlogPosting",
  "FAQPage",
  "Product",
  "LocalBusiness",
  "Organization",
  "Person",
  "WebSite",
  "BreadcrumbList",
] as const;
export const schemaConfig = z
  .object({
    type: z.enum(schemaTypes).default("WebPage"),
    name: text(300).default(""),
    description: text(1000).default(""),
    author: text(160).default(""),
    image: urlField.default(""),
    sku: text(100).default(""),
    price: text(30)
      .regex(/^(?:\d+(?:\.\d{1,2})?)?$/)
      .default(""),
    currency: text(3)
      .regex(/^(?:[A-Z]{3})?$/)
      .default(""),
    availability: z.enum(["", "InStock", "OutOfStock", "PreOrder"]).default(""),
    street: text(200).default(""),
    city: text(100).default(""),
    country: text(2)
      .regex(/^(?:[A-Z]{2})?$/)
      .default(""),
    telephone: text(60).default(""),
    questions: z
      .array(
        z
          .object({ question: text(500).min(1), answer: text(4000).min(1) })
          .strict(),
      )
      .max(30)
      .default([]),
    breadcrumbs: z
      .array(
        z
          .object({ name: text(160).min(1), url: urlField.refine(Boolean) })
          .strict(),
      )
      .max(20)
      .default([]),
    visibleContentConfirmed: z.boolean().default(false),
  })
  .strict();
export type SchemaConfig = z.infer<typeof schemaConfig>;
export const entryConfigSchema = z
  .object({
    keyphrases: z.array(text(120).min(1)).max(20).default([]),
    cornerstone: z.boolean().default(false),
    noFollow: z.boolean().default(false),
    noSnippet: z.boolean().default(false),
    ogTitle: text(300).default(""),
    ogDescription: text(1000).default(""),
    ogImage: urlField.default(""),
    twitterTitle: text(300).default(""),
    twitterDescription: text(1000).default(""),
    twitterImage: urlField.default(""),
    schema: schemaConfig.nullable().default(null),
  })
  .strict();
export type EntryConfig = z.infer<typeof entryConfigSchema>;
export const settingsSchema = z
  .object({
    identity: identitySchema.default({
      type: "Organization",
      name: "",
      url: "",
      logo: "",
    }),
    titleTemplate: text(300).default("{title} {separator} {site}"),
    separator: text(10).default("|"),
    defaultDescription: text(1000).default(""),
    defaultImage: urlField.default(""),
    collections: z.array(identifier).max(100).default([]),
    metadata: z.boolean().default(true),
    schema: z.boolean().default(true),
    readability: z.boolean().default(true),
    language: z.enum(["auto", "en", "structural"]).default("auto"),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export function jsonInput(input: string, max = 48000): unknown {
  if (new TextEncoder().encode(input).length > max)
    throw new Error(`Input exceeds ${max} bytes. Split into smaller batches.`);
  return JSON.parse(input);
}
export function expandTemplate(
  template: string,
  vars: {
    title: string;
    site: string;
    separator: string;
    excerpt: string;
    slug: string;
  },
): string {
  const output = template.replace(/\{([^{}]+)\}/gu, (_, key: string) => {
    if (!Object.hasOwn(vars, key))
      throw new Error(`Unsupported template variable: ${key}`);
    return vars[key as keyof typeof vars];
  });
  if (/[{}]/u.test(output))
    throw new Error("Unbalanced or nested template variables");
  return output.trim();
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableJson(value)),
  );
  return [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

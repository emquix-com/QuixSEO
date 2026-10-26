import { z } from "#validation";
export const identifier = z
  .string()
  .check(z.minLength(1))
  .check(z.maxLength(128))
  .check(z.regex(/^[a-zA-Z0-9_-]+$/));
export const text = (max: number) =>
  z
    .string()
    .check(z.trim())
    .check(z.maxLength(max))
    .check(
      z.refine(
        (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v),
        "Control characters are not allowed",
      ),
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
export const urlField = text(2048).check(
  z.refine((v) => {
    try {
      if (v) httpUrl(v);
      return true;
    } catch {
      return false;
    }
  }, "Use an absolute HTTP(S) URL"),
);
export function canonicalUrl(input: string): string {
  // Legacy workerd URL setters can retain a trailing # for hash="".
  return httpUrl(input).replace(/#.*$/u, "");
}
// Native fields may contain core media IDs or relative paths. Preserve them in
// snapshots; plugin-owned social/schema URLs still require absolute HTTP(S).
export const nativeReference = text(2048).check(
  z.refine((v) => {
    if (!v) return true;
    if (/[\s\\]/u.test(v)) return false;
    try {
      httpUrl(new URL(v, "https://quixseo.invalid/").href);
      return true;
    } catch {
      return false;
    }
  }, "Use an HTTP(S) URL, a safe relative path or a core media ID"),
);
export const seoSchema = z.strictObject({
  title: z.nullable(text(300)),
  description: z.nullable(text(1000)),
  canonical: z.nullable(nativeReference),
  image: z.nullable(nativeReference),
  noIndex: z.boolean(),
});
export type Seo = z.infer<typeof seoSchema>;
export const emptySeo: Seo = {
  title: null,
  description: null,
  canonical: null,
  image: null,
  noIndex: false,
};
export const identitySchema = z.strictObject({
  type: z.enum(["Organization", "Person"]),
  name: text(160),
  url: urlField,
  logo: urlField,
});
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
export const schemaConfig = z.strictObject({
  type: z._default(z.enum(schemaTypes), "WebPage"),
  name: z._default(text(300), ""),
  description: z._default(text(1000), ""),
  author: z._default(text(160), ""),
  image: z._default(urlField, ""),
  sku: z._default(text(100), ""),
  price: z._default(text(30).check(z.regex(/^(?:\d+(?:\.\d{1,2})?)?$/)), ""),
  currency: z._default(text(3).check(z.regex(/^(?:[A-Z]{3})?$/)), ""),
  availability: z._default(
    z.enum(["", "InStock", "OutOfStock", "PreOrder"]),
    "",
  ),
  street: z._default(text(200), ""),
  city: z._default(text(100), ""),
  country: z._default(text(2).check(z.regex(/^(?:[A-Z]{2})?$/)), ""),
  telephone: z._default(text(60), ""),
  questions: z._default(
    z
      .array(
        z.strictObject({
          question: text(500).check(z.minLength(1)),
          answer: text(4000).check(z.minLength(1)),
        }),
      )
      .check(z.maxLength(30)),
    [],
  ),
  breadcrumbs: z._default(
    z
      .array(
        z.strictObject({
          name: text(160).check(z.minLength(1)),
          url: urlField.check(z.refine(Boolean)),
        }),
      )
      .check(z.maxLength(20)),
    [],
  ),
  visibleContentConfirmed: z._default(z.boolean(), false),
});
export type SchemaConfig = z.infer<typeof schemaConfig>;
export const entryConfigSchema = z.strictObject({
  keyphrases: z._default(
    z.array(text(120).check(z.minLength(1))).check(z.maxLength(20)),
    [],
  ),
  cornerstone: z._default(z.boolean(), false),
  noFollow: z._default(z.boolean(), false),
  noSnippet: z._default(z.boolean(), false),
  ogTitle: z._default(text(300), ""),
  ogDescription: z._default(text(1000), ""),
  ogImage: z._default(urlField, ""),
  twitterTitle: z._default(text(300), ""),
  twitterDescription: z._default(text(1000), ""),
  twitterImage: z._default(urlField, ""),
  schema: z._default(z.nullable(schemaConfig), null),
});
export type EntryConfig = z.infer<typeof entryConfigSchema>;
export const settingsSchema = z.strictObject({
  identity: z._default(identitySchema, {
    type: "Organization",
    name: "",
    url: "",
    logo: "",
  }),
  titleTemplate: z._default(text(300), "{title} {separator} {site}"),
  separator: z._default(text(10), "|"),
  defaultDescription: z._default(text(1000), ""),
  defaultImage: z._default(urlField, ""),
  collections: z._default(z.array(identifier).check(z.maxLength(100)), []),
  metadata: z._default(z.boolean(), true),
  schema: z._default(z.boolean(), true),
  readability: z._default(z.boolean(), true),
  language: z._default(z.enum(["auto", "en", "structural"]), "auto"),
});
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

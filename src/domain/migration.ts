import { z } from "zod";
import type { EntryConfig, Seo } from "./validation.js";
import {
  entryConfigSchema,
  identifier,
  seoSchema,
  text,
} from "./validation.js";

const sourceSchema = z
  .object({
    source: z.enum(["yoast", "rankmath"]),
    collection: identifier,
    id: identifier,
    meta: z.record(z.string().max(200), z.unknown()),
  })
  .strict();
export const migrationSchema = z.array(sourceSchema).min(1).max(20);
export interface MigrationRow {
  collection: string;
  id: string;
  seo: Partial<Seo>;
  config: Partial<EntryConfig>;
  warnings: string[];
}
export function migrateRow(
  raw: unknown,
  vars: {
    title: string;
    site: string;
    separator: string;
    excerpt: string;
    slug: string;
  },
): MigrationRow {
  const row = sourceSchema.parse(raw);
  const warnings: string[] = [];
  const seo: Partial<Seo> = {};
  const config: Partial<EntryConfig> = {};
  const prefix = row.source === "yoast" ? "_yoast_wpseo_" : "rank_math_";
  const used = new Set<string>();
  const get = (suffix: string): unknown => {
    used.add(prefix + suffix);
    return row.meta[prefix + suffix];
  };
  const string = (suffix: string): string | undefined => {
    const v = get(suffix);
    if (v === undefined) return undefined;
    return text(4000).parse(v);
  };
  const template = (value: string): string => {
    const tokens: Record<string, string> =
      row.source === "yoast"
        ? {
            title: vars.title,
            sitename: vars.site,
            sep: vars.separator,
            excerpt: vars.excerpt,
          }
        : {
            title: vars.title,
            sitename: vars.site,
            sep: vars.separator,
            excerpt: vars.excerpt,
          };
    const re = row.source === "yoast" ? /%%([^%]+)%%/gu : /%([^%]+)%/gu;
    return value.replace(re, (whole, key: string) => {
      if (!Object.hasOwn(tokens, key)) {
        warnings.push(
          `Unsupported variable ${whole}; map this field manually.`,
        );
        return whole;
      }
      return tokens[key] ?? "";
    });
  };
  const title = string("title"),
    description = string(row.source === "yoast" ? "metadesc" : "description"),
    canonical = string(row.source === "yoast" ? "canonical" : "canonical_url"),
    keywords = string(row.source === "yoast" ? "focuskw" : "focus_keyword");
  if (title !== undefined) {
    const v = template(title);
    if (!/%[^%]+%/u.test(v)) seo.title = v;
  }
  if (description !== undefined) {
    const v = template(description);
    if (!/%[^%]+%/u.test(v)) seo.description = v;
  }
  if (canonical !== undefined) seo.canonical = canonical || null;
  if (keywords !== undefined)
    config.keyphrases =
      row.source === "yoast"
        ? keywords
          ? [keywords]
          : []
        : keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
  if (row.source === "yoast") {
    const index = string("meta-robots-noindex"),
      follow = string("meta-robots-nofollow");
    if (index === "1") seo.noIndex = true;
    else if (index === "2") seo.noIndex = false;
    else if (index && index !== "0")
      warnings.push("Unknown Yoast indexing value omitted.");
    else if (index === "0")
      warnings.push(
        "Yoast inherited indexing requires checking the original global setting.",
      );
    if (follow !== undefined) {
      if (["0", "1"].includes(follow)) config.noFollow = follow === "1";
      else warnings.push("Unknown Yoast follow directive omitted.");
    }
    const cornerstone = string("is_cornerstone");
    if (cornerstone !== undefined)
      config.cornerstone = ["1", "true"].includes(cornerstone);
  } else {
    const robots = get("robots");
    if (robots !== undefined) {
      if (!Array.isArray(robots) || !robots.every((r) => typeof r === "string"))
        warnings.push(
          "Rank Math robots must be a decoded string array; PHP serialization is not executed.",
        );
      else {
        if (robots.includes("noindex")) seo.noIndex = true;
        else if (robots.includes("index")) seo.noIndex = false;
        config.noFollow = robots.includes("nofollow");
        config.noSnippet = robots.includes("nosnippet");
        for (const r of robots)
          if (
            !["index", "noindex", "follow", "nofollow", "nosnippet"].includes(r)
          )
            warnings.push(`Unsupported robots directive: ${r}`);
      }
    }
    const pillar = string("pillar_content");
    if (pillar !== undefined)
      config.cornerstone = ["on", "1", "true"].includes(pillar);
  }
  const social =
    row.source === "yoast"
      ? {
          ogTitle: "opengraph-title",
          ogDescription: "opengraph-description",
          ogImage: "opengraph-image",
          twitterTitle: "twitter-title",
          twitterDescription: "twitter-description",
          twitterImage: "twitter-image",
        }
      : {
          ogTitle: "facebook_title",
          ogDescription: "facebook_description",
          ogImage: "facebook_image",
          twitterTitle: "twitter_title",
          twitterDescription: "twitter_description",
          twitterImage: "twitter_image",
        };
  for (const [target, key] of Object.entries(social)) {
    const value = string(key);
    if (value !== undefined) Object.assign(config, { [target]: value });
  }
  for (const key of Object.keys(row.meta))
    if (!used.has(key)) warnings.push(`Not imported: ${key}`);
  seoSchema.partial().parse(seo);
  entryConfigSchema.partial().parse(config);
  if (seo.noIndex && config.noFollow === false)
    warnings.push(
      "EmDash core noindex also means nofollow; review this semantic difference.",
    );
  return { collection: row.collection, id: row.id, seo, config, warnings };
}

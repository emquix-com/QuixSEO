import type {
  HookHandlers,
  PageMetadataEvent,
  PluginContext,
} from "emdash/plugin";

type PageMetadataContribution = Extract<
  Awaited<ReturnType<HookHandlers["page:metadata"]>>,
  { kind: string }
>;

import { schemaGraph } from "../domain/schema.js";
import { entryConfigSchema } from "../domain/validation.js";
import { entryConfig, settings } from "./context.js";
export async function metadata(
  event: PageMetadataEvent,
  ctx: PluginContext,
): Promise<PageMetadataContribution[]> {
  const config = await settings(ctx);
  if (!config.metadata) return [];
  const page = event.page;
  // Never fetch draft body or enumerate entries from the public rendering path.
  if (page.path === "/404" || !page.canonical) return [];
  const entry = page.content
    ? await entryConfig(ctx, page.content.collection, page.content.id)
    : entryConfigSchema.parse({});
  const out: PageMetadataContribution[] = [];
  const property = (name: string, value: string | undefined | null) => {
    if (value) out.push({ kind: "property", property: name, content: value });
  };
  const meta = (name: string, value: string | undefined | null) => {
    if (value) out.push({ kind: "meta", name, content: value });
  };
  const description = page.description || config.defaultDescription;
  if (!page.description && description) meta("description", description);
  property(
    "og:title",
    entry.ogTitle || page.seo?.ogTitle || page.pageTitle || page.title,
  );
  property(
    "og:description",
    entry.ogDescription || page.seo?.ogDescription || description,
  );
  const image =
    entry.ogImage || page.seo?.ogImage || page.image || config.defaultImage;
  property("og:image", image);
  meta(
    "twitter:title",
    entry.twitterTitle || entry.ogTitle || page.pageTitle || page.title,
  );
  meta(
    "twitter:description",
    entry.twitterDescription || entry.ogDescription || description,
  );
  meta("twitter:image", entry.twitterImage || image);
  meta(
    "twitter:card",
    entry.twitterImage || image ? "summary_large_image" : "summary",
  );
  const robots = new Set(
    (page.seo?.robots ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
  if (entry.noFollow) {
    robots.delete("follow");
    robots.add("nofollow");
  }
  if (entry.noSnippet) robots.add("nosnippet");
  if (robots.size) meta("robots", [...robots].join(", "));
  if (config.schema) {
    const graph = schemaGraph(page, config, entry.schema);
    if (graph) out.push({ kind: "jsonld", id: "primary", graph });
  }
  return out;
}

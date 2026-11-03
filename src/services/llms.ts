import {
  type PluginContext,
  pluginResponse,
  type SandboxedRouteContext,
} from "emdash/plugin";
import { z } from "#validation";
import {
  LLMS_COLLECTION_LIMIT,
  LLMS_ENTRY_LIMIT,
  type LlmsConfig,
  type LlmsLink,
  llmsConfigSchema,
  renderLlms,
} from "../domain/llms.js";
import { analysisUrls, resolveCanonical, usableUrl } from "../domain/urls.js";
import { storage, titleOf } from "./context.js";

export const LLMS_ROUTE = "/_emdash/api/plugins/quixseo/llms-txt";
export const llmsSettings = async (ctx: PluginContext): Promise<LlmsConfig> =>
  llmsConfigSchema.parse((await storage(ctx, "settings").get("llms")) ?? {});

export function llmsUrls(siteValue: string) {
  const site = analysisUrls(siteValue, null).site;
  if (!site) return null;
  const base = site.replace(/\/$/u, "");
  return { site, endpoint: `${base}${LLMS_ROUTE}`, root: `${base}/llms.txt` };
}

/** Bounded, fresh published reads. No draft revisions, audit snapshots, bodies or network calls. */
export async function generateLlms(ctx: PluginContext, config: LlmsConfig) {
  const urls = llmsUrls(ctx.site.url);
  if (!urls)
    throw new Error(
      "Configure your Site URL in EmDash → Settings before generating llms.txt.",
    );
  if (!ctx.schema || !ctx.content?.getPublicUrl)
    throw new Error(
      "Content and schema read access are required for llms.txt.",
    );
  const site = new URL(urls.site);
  const basePath = site.pathname.replace(/\/$/u, "");
  const allCollections = (await ctx.schema.listCollections())
    .filter(
      (c) =>
        c.hasSeo &&
        c.routable &&
        !c.hidden &&
        (!config.collections.length || config.collections.includes(c.slug)),
    )
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const collections = allCollections.slice(0, LLMS_COLLECTION_LIMIT);
  const links: LlmsLink[] = [],
    seen = new Set<string>();
  let scanned = 0,
    skipped = 0,
    truncated = allCollections.length > collections.length;
  for (const [index, collection] of collections.entries()) {
    let cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      const page = await ctx.content.list(collection.slug, {
        limit: Math.min(10, LLMS_ENTRY_LIMIT - scanned),
        cursor,
        where: { status: "published" },
        orderBy: { createdAt: "desc" },
      });
      for (const item of page.items) {
        if (scanned >= LLMS_ENTRY_LIMIT) {
          truncated = true;
          break;
        }
        scanned++;
        if (item.status !== "published" || item.seo?.noIndex) {
          skipped++;
          continue;
        }
        const context = analysisUrls(
          ctx.site.url,
          await ctx.content.getPublicUrl(collection.slug, item.id),
        );
        const url = usableUrl(context.page);
        const canonical = item.seo?.canonical
          ? resolveCanonical(item.seo.canonical, context)
          : context.page;
        if (
          !url ||
          url.origin !== site.origin ||
          url.search ||
          (basePath &&
            url.pathname !== basePath &&
            !url.pathname.startsWith(`${basePath}/`)) ||
          url.pathname.startsWith(`${basePath}/_emdash/`) ||
          canonical !== context.page ||
          seen.has(url.href)
        ) {
          skipped++;
          continue;
        }
        seen.add(url.href);
        links.push({
          title: titleOf(item, collection.titleField || "title"),
          url: url.href,
          collection: collection.label || collection.slug,
        });
      }
      if (!page.hasMore) break;
      if (scanned >= LLMS_ENTRY_LIMIT) {
        truncated = true;
        break;
      }
      if (!page.items.length || !page.cursor || cursors.has(page.cursor))
        throw new Error(
          "Content pagination did not advance; retry generating llms.txt.",
        );
      cursors.add(page.cursor);
      cursor = page.cursor;
    } while (scanned < LLMS_ENTRY_LIMIT);
    if (scanned >= LLMS_ENTRY_LIMIT) {
      if (index < collections.length - 1) truncated = true;
      break;
    }
  }
  const result = renderLlms(ctx.site.name, config.summary, links);
  return {
    ...result,
    scanned,
    skipped,
    truncated: truncated || result.truncated,
  };
}

/** Public, read-only text route; disabled by default and never cached by QuixSEO. */
export async function llmsRoute(
  route: SandboxedRouteContext,
  ctx: PluginContext,
) {
  const reply = (status: number, value: string, download = false) =>
    pluginResponse({
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...(download
          ? { "content-disposition": 'attachment; filename="llms.txt"' }
          : {}),
      },
      body: route.request.method === "HEAD" ? null : { kind: "text", value },
    });
  const query = z
    .strictObject({ download: z.optional(z.literal("1")) })
    .safeParse(route.input);
  if (!query.success) return reply(400, "Unsupported llms.txt request.\n");
  try {
    const config = await llmsSettings(ctx);
    if (!config.enabled) return reply(404, "Not found.\n");
    if (!llmsUrls(ctx.site.url))
      return reply(
        503,
        "llms.txt is unavailable until the Site URL is configured.\n",
      );
    const result = await generateLlms(ctx, config);
    return reply(200, result.text, query.data.download === "1");
  } catch {
    // Log a stable diagnostic, never expose unpublished data or internal errors publicly.
    ctx.log.error(
      "QuixSEO llms.txt generation failed; retry from Setup & settings for details.",
    );
    return reply(503, "llms.txt is temporarily unavailable.\n");
  }
}

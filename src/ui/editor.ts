import type { Block, BlockResponse } from "@emdash-cms/blocks";
import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import { z } from "zod";
import { analyze } from "../domain/analysis.js";
import { validateSchema } from "../domain/schema.js";
import {
  entryConfigSchema,
  jsonInput,
  schemaConfig,
  seoSchema,
  text,
} from "../domain/validation.js";
import type { ChangePlan } from "../services/changes.js";
import { applyChange, previewChanges } from "../services/changes.js";
import {
  actor,
  bodyOf,
  entryConfig,
  getEntry,
  settings,
  storage,
  titleOf,
} from "../services/context.js";
import {
  analysisBlocks,
  context,
  form,
  header,
  input,
  response,
  section,
  toggle,
} from "./components.js";
import { planBlocks } from "./plans.js";

const editorValues = z
  .object({
    title: text(300),
    description: text(1000),
    canonical: text(2048),
    image: text(2048),
    noIndex: z.boolean(),
    keyphrases: text(2500),
    cornerstone: z.boolean(),
    noFollow: z.boolean(),
    noSnippet: z.boolean(),
    ogTitle: text(300),
    ogDescription: text(1000),
    ogImage: text(2048),
    twitterTitle: text(300),
    twitterDescription: text(1000),
    twitterImage: text(2048),
    schema: text(20000),
  })
  .strict();
export async function editor(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<BlockResponse> {
  const actorId = actor(route, 30);
  if (route.ui?.surface !== "content-editor-panel")
    throw new Error("Open QuixSEO from a saved content entry");
  const ref = route.ui.entry;
  const interaction = z
    .object({
      type: z.enum(["panel_load", "form_submit", "block_action"]),
      action_id: z.string().optional(),
      value: z.unknown().optional(),
      values: z.unknown().optional(),
      block_id: z.string().optional(),
    })
    .passthrough()
    .parse(route.input);
  if (
    interaction.action_id === "confirm" ||
    interaction.action_id === "rollback"
  ) {
    const id = z.string().uuid().parse(interaction.value);
    const previous = await storage<ChangePlan>(ctx, "changes").get(id);
    if (
      !previous ||
      previous.kind !== "editor" ||
      previous.rows.length !== 1 ||
      previous.rows.some(
        (r) => r.collection !== ref.collection || r.id !== ref.id,
      )
    )
      throw new Error("Preview belongs to another entry");
    const plan = await applyChange(
      ctx,
      actorId,
      id,
      interaction.action_id === "rollback",
    );
    return response(planBlocks(plan));
  }
  if (interaction.action_id === "preview-editor") {
    const values = editorValues.parse(interaction.values);
    const {
      title: _title,
      description: _description,
      canonical: _canonical,
      image: _image,
      noIndex: _noIndex,
      ...extra
    } = values;
    const config = entryConfigSchema.parse({
      ...extra,
      keyphrases: values.keyphrases
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      schema: values.schema.trim()
        ? schemaConfig.parse(jsonInput(values.schema))
        : null,
    });
    if (config.schema) {
      const errors = validateSchema(config.schema);
      if (errors.length) throw new Error(errors.join(" "));
    }
    const seo = seoSchema.parse({
      title: values.title || null,
      description: values.description || null,
      canonical: values.canonical || null,
      image: values.image || null,
      noIndex: values.noIndex,
    });
    const plan = await previewChanges(
      ctx,
      actorId,
      [{ collection: ref.collection, id: ref.id, seo, config }],
      "editor",
    );
    return response(planBlocks(plan));
  }
  const [item, config, site, collection] = await Promise.all([
    getEntry(ctx, ref.collection, ref.id),
    entryConfig(ctx, ref.collection, ref.id),
    settings(ctx),
    ctx.schema?.getCollection(ref.collection),
  ]);
  const title = titleOf(item, collection?.titleField || "title");
  const url =
    (await ctx.content?.getPublicUrl?.(ref.collection, ref.id)) ??
    new URL(`/${encodeURIComponent(item.slug || "draft")}`, ctx.site.url).href;
  const analysis = analyze({
    title: item.seo?.title || title,
    description: item.seo?.description || String(item.data.excerpt ?? ""),
    url,
    body: bodyOf(
      item,
      collection?.fields.find((f) => f.type === "portableText")?.slug,
    ),
    keyphrases: config.keyphrases,
    locale: item.locale || ctx.site.locale,
    readability: site.readability,
    language: site.language,
  });
  const blocks: Block[] = [
    header("QuixSEO"),
    context(
      "Complete SEO Toolkit for EmDash · Webtaculos · Saved content analysis. Save changes and reopen this panel to refresh.",
    ),
    ...analysisBlocks(analysis),
    {
      type: "accordion",
      label: "Search appearance preview",
      blocks: [
        section(item.seo?.title || title),
        context(url),
        section(
          item.seo?.description ||
            String(item.data.excerpt ?? "No description"),
        ),
        context(
          "Approximation only. Search engines may rewrite titles and snippets. Theme must render getSeoMeta().",
        ),
      ],
    },
    {
      type: "accordion",
      label: "Social sharing preview",
      blocks: [
        section(config.ogTitle || item.seo?.title || title),
        section(
          config.ogDescription || item.seo?.description || "No description",
        ),
        context(
          `Image: ${config.ogImage || item.seo?.image || site.defaultImage || "Not configured"}`,
        ),
      ],
    },
  ];
  if (!item.seo) {
    blocks.push(
      section(
        "Enable SEO for this collection in EmDash Content Types to edit metadata.",
      ),
    );
    return response(blocks);
  }
  blocks.push(
    context(
      "Native title, description, canonical, image and noindex values below are for preview only in EmDash 1.3.1. Save them in EmDash’s SEO panel. Leave them unchanged here to save QuixSEO keyphrases, social overrides and schema.",
    ),
    form("preview-editor", "Preview SEO changes", [
      input("title", "SEO title", item.seo.title ?? ""),
      input(
        "description",
        "Meta description",
        item.seo.description ?? "",
        true,
      ),
      input(
        "canonical",
        "Native canonical (URL or relative path)",
        item.seo.canonical ?? "",
      ),
      input(
        "image",
        "Native social image (URL, path or media ID)",
        item.seo.image ?? "",
      ),
      toggle(
        "noIndex",
        "Hide from search engines (core noindex, nofollow; excluded from sitemap)",
        item.seo.noIndex,
      ),
      input(
        "keyphrases",
        "Focus keyphrases, comma separated",
        config.keyphrases.join(", "),
      ),
      toggle("cornerstone", "Cornerstone content", config.cornerstone),
      toggle("noFollow", "Nofollow links on this page", config.noFollow),
      toggle("noSnippet", "Suppress search snippets", config.noSnippet),
      input("ogTitle", "Open Graph title", config.ogTitle),
      input(
        "ogDescription",
        "Open Graph description",
        config.ogDescription,
        true,
      ),
      input("ogImage", "Open Graph image URL", config.ogImage),
      input("twitterTitle", "X / Twitter title", config.twitterTitle),
      input(
        "twitterDescription",
        "X / Twitter description",
        config.twitterDescription,
        true,
      ),
      input("twitterImage", "X / Twitter image URL", config.twitterImage),
      input(
        "schema",
        "Advanced schema configuration (JSON; leave empty for WebPage defaults)",
        config.schema ? JSON.stringify(config.schema, null, 2) : "",
        true,
      ),
    ]),
    context(
      "Schema types: Organization, Person, WebSite, WebPage, Article, BlogPosting, BreadcrumbList, FAQPage, Product, LocalBusiness. See docs/schema.md for validated fields.",
    ),
  );
  return response(blocks);
}
export async function draft(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<unknown> {
  actor(route, 30);
  if (route.ui?.surface !== "content-editor-action")
    throw new Error("Draft analysis requires an editor action");
  const payload = z
    .object({
      draft: z
        .object({ fields: z.record(z.string(), z.unknown()) })
        .passthrough(),
    })
    .passthrough()
    .parse(route.input);
  const a = analyze({
    title: String(payload.draft.fields.title ?? ""),
    description: String(payload.draft.fields.excerpt ?? ""),
    body: payload.draft.fields.body ?? payload.draft.fields.content,
    url: ctx.site.url,
    keyphrases: [],
    locale: route.ui.entry.locale || ctx.site.locale,
    readability: true,
    language: "auto",
  });
  const recommendations = a.checks
    .filter((c) => c.status === "problem" || c.status === "improve")
    .slice(0, 2)
    .map((c) => c.message)
    .join(". ");
  return {
    toast: {
      type: "info",
      message: `Unsaved draft checklist: ${a.score ?? "—"}/100. ${recommendations || "No issues in the checked rules."} Save and open QuixSEO for full saved SEO checks.`,
    },
  };
}

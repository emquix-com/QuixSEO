import type { Block, BlockResponse } from "@emdash-cms/blocks";
import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import { z } from "#validation";
import { validateSchema } from "../domain/schema.js";
import { siteUrlWarning } from "../domain/urls.js";
import {
  entryConfigSchema,
  fingerprint,
  jsonInput,
  schemaConfig,
  text,
} from "../domain/validation.js";
import type { ChangePlan } from "../services/changes.js";
import { applyChange, previewChanges } from "../services/changes.js";
import { actor, storage } from "../services/context.js";
import { editorContent } from "../services/editor-content.js";
import {
  actions,
  analysisBlocks,
  button,
  context,
  form,
  header,
  input,
  response,
  section,
  toggle,
} from "./components.js";
import { planBlocks } from "./plans.js";

const editorValues = z.strictObject({
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
});
async function renderEditor(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<BlockResponse> {
  const actorId = actor(route, 30);
  if (route.ui?.surface !== "content-editor-panel")
    throw new Error("Open QuixSEO from a saved content entry");
  const ref = route.ui.entry;
  const interaction = z
    .looseObject({
      type: z.enum(["panel_load", "form_submit", "block_action"]),
      action_id: z.optional(z.string()),
      value: z.optional(z.unknown()),
      values: z.optional(z.unknown()),
      block_id: z.optional(z.string()),
    })
    .parse(route.input);
  if (
    interaction.action_id === "confirm" ||
    interaction.action_id === "rollback"
  ) {
    const id = z.string().check(z.uuid()).parse(interaction.value);
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
    return response(planBlocks(plan, "editor"));
  }
  if (interaction.action_id?.startsWith("save-editor:")) {
    if (interaction.type !== "form_submit")
      throw new Error("Submit the settings form");
    const values = editorValues.parse(interaction.values);
    const config = entryConfigSchema.parse({
      ...values,
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
    const plan = await previewChanges(
      ctx,
      actorId,
      [{ collection: ref.collection, id: ref.id, seo: {}, config }],
      "editor",
      interaction.action_id.slice("save-editor:".length),
    );
    const applied = await applyChange(ctx, actorId, plan.id);
    if (applied.rows[0]?.status !== "applied")
      throw new Error(
        applied.rows[0]?.error ||
          "Settings were not saved. Retry after refreshing.",
      );
    const message =
      "QuixSEO settings saved. Content publication status is unchanged.";
    try {
      const panel = await renderEditor(
        { ...route, input: { type: "panel_load" } },
        ctx,
      );
      panel.toast = { type: "success", message };
      return panel;
    } catch {
      return response(
        [
          section(message),
          context(
            "Analysis could not be refreshed. Refresh saved analysis to retry.",
          ),
          actions(button("refresh-saved", "Refresh saved analysis")),
        ],
        message,
      );
    }
  }
  const current = interaction.action_id === "analyze-current";
  const snapshot = current
    ? z
        .object({
          draft: z
            .unknown()
            .check(
              z.refine(
                (v) => v !== undefined,
                "Current editor content was not supplied. Reopen this entry and retry the action.",
              ),
            ),
        })
        .parse(route.input).draft
    : undefined;
  const {
    item,
    config,
    site,
    title,
    urls,
    analysis,
    source,
    warning,
    detail,
    data,
  } = await editorContent(ctx, ref, snapshot);
  const blocks: Block[] = [
    header("QuixSEO"),
    context("Complete SEO Toolkit for EmDash · EmQuix"),
    section(source),
    context(
      "Analysis uses saved SEO metadata and QuixSEO settings. Unsaved changes in EmDash’s native SEO controls are not included. Draft public paths are not assessed; compare scores only with equivalent coverage.",
    ),
    actions(button("analyze-current", "Analyze current editor")),
    actions(button("refresh-saved", "Refresh saved analysis")),
    ...(warning
      ? [
          {
            type: "banner" as const,
            variant: "alert" as const,
            title: "Content source notice",
            description: warning,
          },
        ]
      : []),
    ...(detail
      ? [
          {
            type: "accordion" as const,
            label: "Entry details",
            blocks: [context(detail.slice(0, 1000))],
          },
        ]
      : []),
    ...(!urls.site
      ? [
          {
            type: "banner" as const,
            variant: "alert" as const,
            ...siteUrlWarning,
          },
        ]
      : []),
    ...analysisBlocks(analysis),
    {
      type: "accordion",
      label: "Search appearance preview",
      blocks: [
        section(item.seo?.title || title),
        context(
          source === "Published content"
            ? (urls.page ??
                "Public URL unavailable — no route is assumed for this preview.")
            : `Saved public URL: ${urls.page ?? "Not available"}. The draft path is not assessed.`,
        ),
        section(
          item.seo?.description || String(data.excerpt ?? "No description"),
        ),
        context(
          "Approximation only. Search engines may rewrite titles and snippets. Theme must render getSeoMeta().",
        ),
        context(
          item.seo?.description
            ? "Description source: saved SEO metadata."
            : "Description source: excerpt fallback for preview; no explicit SEO description is saved.",
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
      "Manage native SEO title, description, canonical URL, indexing and social image in EmDash’s SEO panel. QuixSEO reads these saved values. Save the additional settings below separately; EmDash Save and autosave do not submit this form. Settings on published entries take effect immediately.",
    ),
    form(`save-editor:${await fingerprint(config)}`, "Save QuixSEO settings", [
      input(
        "keyphrases",
        "Focus keyphrases, comma separated",
        config.keyphrases.join(", "),
      ),
      toggle("cornerstone", "Cornerstone content", config.cornerstone),
      toggle("noFollow", "Nofollow links on this page", config.noFollow),
      toggle("noSnippet", "Suppress search snippets", config.noSnippet),
      input("ogTitle", "Open Graph title override", config.ogTitle),
      input(
        "ogDescription",
        "Open Graph description override",
        config.ogDescription,
        true,
      ),
      input("ogImage", "Open Graph image URL override", config.ogImage),
      input("twitterTitle", "X / Twitter title override", config.twitterTitle),
      input(
        "twitterDescription",
        "X / Twitter description override",
        config.twitterDescription,
        true,
      ),
      input(
        "twitterImage",
        "X / Twitter image URL override",
        config.twitterImage,
      ),
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
/** Preserve submitted settings on validation/conflict errors so editors can copy or correct them. */
export async function editor(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<BlockResponse> {
  try {
    return await renderEditor(route, ctx);
  } catch (error) {
    const interaction = route.input as { action_id?: string; values?: unknown };
    if (!interaction.action_id?.startsWith("save-editor:")) throw error;
    const submitted = z
      .record(z.string(), z.union([z.string(), z.boolean()]))
      .safeParse(interaction.values);
    if (!submitted.success) throw error;
    // Rechecks host-bound surface and role; never turn permission failures into an editable form.
    const panel = await renderEditor(
      { ...route, input: { type: "panel_load" } },
      ctx,
    );
    for (const block of panel.blocks) {
      if (block.type !== "form") continue;
      block.submit.action_id = interaction.action_id;
      block.block_id = interaction.action_id;
      for (const field of block.fields) {
        const value =
          submitted.data[field.action_id as keyof typeof submitted.data];
        if (field.type === "text_input" && typeof value === "string")
          field.initial_value = value;
        if (field.type === "toggle" && typeof value === "boolean")
          field.initial_value = value;
      }
    }
    const message =
      error instanceof Error ? error.message : "Settings could not be saved";
    panel.blocks.unshift({
      type: "banner",
      variant: "error",
      description: message,
    });
    panel.toast = {
      type: "error",
      message:
        "Settings were not saved. Your submitted values are retained below.",
    };
    return panel;
  }
}
export async function draft(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<unknown> {
  actor(route, 30);
  if (route.ui?.surface !== "content-editor-action")
    throw new Error("Draft analysis requires an editor action");
  const payload = z
    .looseObject({ draft: z.unknown().check(z.refine((v) => v !== undefined)) })
    .parse(route.input);
  const result = await editorContent(ctx, route.ui.entry, payload.draft);
  const recommendations = result.analysis.checks
    .filter((c) => c.status === "problem" || c.status === "improve")
    .slice(0, 2)
    .map((c) => c.message)
    .join(" ");
  return {
    toast: {
      type: "info",
      message: `Unsaved draft checklist: ${result.analysis.score ?? "—"}/100 (partial analysis). ${!result.urls.site ? `${siteUrlWarning.title}. ${siteUrlWarning.description} ` : ""}${result.warning} ${recommendations} Use Analyze current editor in the QuixSEO sidebar for full findings. Saved SEO metadata is used; unsaved URL changes are not assessed.`,
    },
  };
}

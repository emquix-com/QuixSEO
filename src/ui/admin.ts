import type { Block, BlockResponse } from "@emdash-cms/blocks";
import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";
import { z } from "#validation";
import { llmsConfigSchema } from "../domain/llms.js";
import { migrateRow, migrationSchema } from "../domain/migration.js";
import { redirectIssues, redirectSchema } from "../domain/redirects.js";
import {
  entryConfigPatchSchema,
  expandTemplate,
  identifier,
  jsonInput,
  seoSchema,
  settingsSchema,
  text,
  validationMessage,
} from "../domain/validation.js";
import type { AuditJob, AuditRecord } from "../services/audit.js";
import { cancelAudit, resumeAudit, startAudit } from "../services/audit.js";
import type { ChangePlan, Proposal } from "../services/changes.js";
import {
  applyChange,
  prepareNext,
  previewChanges,
} from "../services/changes.js";
import {
  actor,
  getEntry,
  settings,
  storage,
  titleOf,
} from "../services/context.js";
import { llmsUrls } from "../services/llms.js";
import {
  auditBlocks,
  auditHistory,
  findingBlocks,
  reportsView,
  suggestionsView,
} from "./audits.js";
import {
  actions,
  button,
  context,
  editLink,
  form,
  header,
  input,
  response,
  section,
  select,
  toggle,
} from "./components.js";
import { llmsBlocks, llmsPreview } from "./llms.js";
import { planBlocks } from "./plans.js";

const interactionSchema = z.looseObject({
  type: z.enum(["page_load", "block_action", "form_submit"]),
  page: z.optional(z.string().check(z.maxLength(100))),
  action_id: z.optional(z.string().check(z.maxLength(100))),
  block_id: z.optional(z.string()),
  value: z.optional(z.unknown()),
  values: z.optional(z.record(z.string(), z.unknown())),
});
const proposalSchema = z.strictObject({
  collection: identifier,
  id: identifier,
  seo: z._default(z.partial(seoSchema), {}),
  config: z._default(entryConfigPatchSchema, {}),
});
const uuid = z.string().check(z.uuid());
async function bulkView(
  ctx: PluginContext,
  values: Record<string, unknown> = {},
): Promise<Block[]> {
  const collection = values.collection
    ? identifier.parse(values.collection)
    : "posts";
  const search = text(100)
    .parse(values.search ?? "")
    .toLowerCase();
  const filter = z
    .enum(["all", "missing-title", "missing-description", "noindex"])
    .parse(values.filter ?? "all");
  const cursor = typeof values.cursor === "string" ? values.cursor : undefined;
  const collections = ((await ctx.schema?.listCollections()) ?? []).filter(
    (c) => c.hasSeo,
  );
  if (!collections.length)
    return [
      header("Bulk SEO editor"),
      section("Enable SEO on a collection before editing metadata."),
    ];
  const chosen =
    collections.find((c) => c.slug === collection) ?? collections[0];
  if (!chosen) throw new Error("No collection");
  const siteSettings = await settings(ctx);
  const page = await ctx.content?.list(chosen.slug, { limit: 20, cursor });
  const items = (page?.items ?? []).filter(
    (i) =>
      (!search ||
        titleOf(i, chosen.titleField || "title")
          .toLowerCase()
          .includes(search)) &&
      (filter === "all" ||
        (filter === "noindex" && i.seo?.noIndex) ||
        (filter === "missing-title" && !i.seo?.title) ||
        (filter === "missing-description" && !i.seo?.description)),
  );
  return [
    header("Bulk SEO editor"),
    context(
      "Filter applies to this 20-entry page; continue through pages to inspect the entire collection. No content is published by these operations.",
    ),
    form("bulk-filter", "Apply page filter", [
      select(
        "collection",
        "Collection",
        collections.map((c) => c.slug),
        chosen.slug,
      ),
      input("search", "Title contains", search),
      select(
        "filter",
        "Show",
        ["all", "missing-title", "missing-description", "noindex"],
        filter,
      ),
    ]),
    {
      type: "table",
      page_action_id: "bulk-page",
      columns: [
        { key: "id", label: "Entry ID", format: "code" },
        { key: "title", label: "Title" },
        { key: "seo", label: "SEO title" },
        { key: "description", label: "Description" },
        { key: "edit", label: "Open", format: "element" },
      ],
      rows: items.map((i) => ({
        id: i.id,
        title: titleOf(i, chosen.titleField || "title"),
        seo: i.seo?.title || "Not set",
        description: i.seo?.description || "Not set",
        edit: editLink(chosen.slug, i.id, i.locale ?? undefined),
      })),
      empty_text: "No matching entries on this page",
    },
    ...(page?.hasMore
      ? [
          actions(
            button("bulk-next", "Next content page", {
              collection: chosen.slug,
              search,
              filter,
              cursor: page.cursor,
            }),
          ),
        ]
      : []),
    form("bulk-preview", "Prepare change preview", [
      input(
        "changes",
        "Changes as JSON array (up to 20 entries)",
        JSON.stringify(
          items.slice(0, 1).map((i) => ({
            collection: chosen.slug,
            id: i.id,
            seo: {
              title: i.seo?.title ?? "",
              description: i.seo?.description ?? "",
            },
          })),
          null,
          2,
        ),
        true,
      ),
    ]),
    form("template-preview", "Preview template for one entry", [
      input("collection", "Collection", chosen.slug),
      input("id", "Entry ID"),
      input("title", "Title template", siteSettings.titleTemplate),
      input("description", "Description template", "{excerpt}"),
    ]),
    context(
      "Bulk config changes can save keyphrases, cornerstone, robots additions, social overrides and schema. Omitted config fields stay unchanged. Native SEO fields are preview-only on the tested EmDash 1.3.1 and 1.4.0 runtimes; save them in the core SEO panel. Review each step before confirmation.",
    ),
  ];
}
async function settingsView(ctx: PluginContext): Promise<Block[]> {
  const s = await settings(ctx);
  return [
    header("Set up QuixSEO"),
    context(
      "Configure your identity, then run an initial audit. Core Settings → SEO manages robots.txt, sitemap defaults, verification tags and the title separator used by your theme.",
    ),
    form("save-settings", "Save settings", [
      select(
        "identityType",
        "Site represents",
        ["Organization", "Person"],
        s.identity.type,
      ),
      input("identityName", "Public name", s.identity.name),
      input("identityUrl", "Identity website", s.identity.url),
      input("identityLogo", "Logo or profile image URL", s.identity.logo),
      input("titleTemplate", "Default title template", s.titleTemplate),
      input("separator", "Template separator", s.separator),
      input(
        "defaultDescription",
        "Fallback meta description",
        s.defaultDescription,
        true,
      ),
      input("defaultImage", "Default social image URL", s.defaultImage),
      input(
        "collections",
        "Collections to audit, comma separated (empty = all SEO-enabled)",
        s.collections.join(","),
      ),
      toggle(
        "metadata",
        "Enable metadata contributions (disable when another SEO plugin owns output)",
        s.metadata,
      ),
      toggle("schema", "Enable structured data graph", s.schema),
      toggle("readability", "Enable readability analysis", s.readability),
      select(
        "language",
        "Readability rules",
        ["auto", "en", "structural"],
        s.language,
      ),
    ]),
    context(
      "Templates are applied explicitly through previews; the metadata hook cannot change your theme’s <title>. Preferred indexing stays in the native per-entry SEO field so sitemap behavior stays consistent.",
    ),
    ...(await llmsBlocks(ctx)),
  ];
}
async function redirectView(
  ctx: PluginContext,
  cursor?: string,
): Promise<Block[]> {
  const page = await ctx.redirects?.list({ limit: 20, cursor });
  return [
    header("Redirects"),
    context(
      "Native EmDash rules. Use EmDash Redirects → 404 Errors for the real original-path log. No network crawl is performed here. Pattern rules and global chain inspection remain in core.",
    ),
    {
      type: "table",
      page_action_id: "redirect-page",
      columns: [
        { key: "source", label: "Source" },
        { key: "destination", label: "Destination" },
        { key: "type", label: "Status" },
        { key: "enabled", label: "Enabled" },
      ],
      rows: (page?.items ?? []).map((r) => ({
        source: r.source,
        destination: r.destination,
        type: r.type,
        enabled: r.enabled ? "Yes" : "No",
      })),
      empty_text: "No redirects",
    },
    ...(page?.hasMore
      ? [actions(button("redirect-next", "Next redirects", page.cursor))]
      : []),
    form("redirect-preview", "Validate redirect", [
      input("source", "Source local path"),
      input("destination", "Destination local path or absolute URL"),
      select("type", "HTTP status", ["301", "302"], "301"),
    ]),
    {
      type: "accordion",
      label: "Export this page (JSON)",
      blocks: [
        {
          type: "code",
          language: "jsonc",
          code: JSON.stringify(
            (page?.items ?? [])
              .filter((r) => r.type === 301 || r.type === 302)
              .map((r) => ({
                source: r.source,
                destination: r.destination,
                type: r.type,
              })),
            null,
            2,
          ),
        },
      ],
    },
    form("redirect-import", "Validate redirect JSON", [
      input("json", "Paste one exported redirect object", "", true),
    ]),
  ];
}
async function renderAdmin(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<BlockResponse> {
  const actorId = actor(route, 40);
  const i = interactionSchema.parse(route.input);
  const a = i.action_id,
    v = i.values ?? {};
  let blocks: Block[] = [];
  if (a === "save-llms") {
    actor(route, 50);
    const config = llmsConfigSchema.parse({
      enabled: v.enabled,
      summary: v.summary,
      collections: text(2000)
        .parse(v.collections)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (config.enabled && !llmsUrls(ctx.site.url))
      throw new Error(
        "Configure your Site URL in EmDash → Settings before enabling llms.txt.",
      );
    await storage(ctx, "settings").put("llms", config);
    return response(await settingsView(ctx), "llms.txt settings saved");
  }
  if (a === "llms-preview") {
    actor(route, 50);
    return response(await llmsPreview(ctx));
  }
  if (a === "save-settings") {
    actor(route, 50);
    const s = settingsSchema.parse({
      identity: {
        type: v.identityType,
        name: v.identityName,
        url: v.identityUrl,
        logo: v.identityLogo,
      },
      titleTemplate: v.titleTemplate,
      separator: v.separator,
      defaultDescription: v.defaultDescription,
      defaultImage: v.defaultImage,
      collections: text(2000)
        .parse(v.collections)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      metadata: v.metadata,
      schema: v.schema,
      readability: v.readability,
      language: v.language,
    });
    expandTemplate(s.titleTemplate, {
      title: "Title",
      site: "Site",
      separator: s.separator,
      excerpt: "Excerpt",
      slug: "slug",
    });
    await storage(ctx, "settings").put("site", s);
    return response(await settingsView(ctx), "QuixSEO settings saved");
  }
  if (a === "audit-start") blocks = auditBlocks(await startAudit(ctx, actorId));
  else if (a === "audit-next" || a === "audit-resume")
    blocks = auditBlocks(await resumeAudit(ctx, uuid.parse(i.value)));
  else if (a === "audit-cancel")
    blocks = auditBlocks(await cancelAudit(ctx, uuid.parse(i.value)));
  else if (a === "audit-status") {
    const job = await storage<AuditJob>(ctx, "jobs").get(uuid.parse(i.value));
    if (!job) throw new Error("Audit not found");
    blocks = auditBlocks(job);
  } else if (a === "audit-results")
    blocks = await reportsView(ctx, uuid.parse(i.value));
  else if (a?.startsWith("reports-filter:")) {
    const id = uuid.parse(a.slice("reports-filter:".length));
    const page = i.block_id?.startsWith("reports-page:")
      ? z
          .object({
            id: uuid,
            cursor: z.optional(z.string().check(z.maxLength(4096))),
          })
          .parse(JSON.parse(i.block_id.slice("reports-page:".length)))
      : undefined;
    if (page && page.id !== id)
      throw new Error(
        "Audit page does not match this review. Reload the results.",
      );
    blocks = await reportsView(
      ctx,
      id,
      page?.cursor,
      z.enum(["all", "needs-attention", "unavailable"]).parse(v.filter),
      z.enum(["lowest-score", "title"]).parse(v.sort),
    );
  } else if (a === "reports-next") {
    const p = z
      .object({
        id: uuid,
        cursor: z.string().check(z.maxLength(4096)),
        filter: z._default(
          z.enum(["all", "needs-attention", "unavailable"]),
          "all",
        ),
        sort: z._default(z.enum(["lowest-score", "title"]), "lowest-score"),
      })
      .parse(i.value);
    blocks = await reportsView(ctx, p.id, p.cursor, p.filter, p.sort);
  } else if (a === "audit-entry") {
    const r = await storage<AuditRecord>(ctx, "reports").get(
      z.string().check(z.maxLength(300)).parse(i.value),
    );
    if (!r) throw new Error("Audit record not found");
    blocks = [
      header(r.title),
      actions(button("audit-results", "Back to audit results", r.job)),
      {
        type: "columns",
        columns: [
          findingBlocks(r),
          [
            section("About these findings"),
            context(
              "Fix identifies detected problems. Review includes contextual suggestions; optional keyphrase advice is unscored. N/A means a check is unavailable or not applicable. Only published content in this audit is assessed.",
            ),
          ],
        ],
      },
    ];
  } else if (a === "related")
    blocks = await suggestionsView(
      ctx,
      z.string().check(z.maxLength(300)).parse(i.value),
    );
  else if (a === "related-next") {
    const p = z
      .object({
        id: z.string().check(z.maxLength(300)),
        cursor: z.string().check(z.maxLength(4096)),
      })
      .parse(i.value);
    blocks = await suggestionsView(ctx, p.id, p.cursor);
  } else if (a === "audit-history" || a === "audits-next")
    blocks = await auditHistory(
      ctx,
      a === "audits-next"
        ? z.string().check(z.maxLength(4096)).parse(i.value)
        : undefined,
    );
  else if (a === "bulk-filter" || a === "bulk-next")
    blocks = await bulkView(
      ctx,
      a === "bulk-next" ? z.record(z.string(), z.unknown()).parse(i.value) : v,
    );
  else if (a === "bulk-preview") {
    const proposals = z
      .array(proposalSchema)
      .check(z.minLength(1))
      .check(z.maxLength(20))
      .parse(jsonInput(text(48000).parse(v.changes)));
    blocks = planBlocks(await previewChanges(ctx, actorId, proposals, "bulk"));
  } else if (a === "template-preview") {
    const c = identifier.parse(v.collection),
      id = identifier.parse(v.id);
    const [item, s] = await Promise.all([getEntry(ctx, c, id), settings(ctx)]);
    const vars = {
      title: titleOf(item),
      site: ctx.site.name,
      separator: s.separator,
      excerpt: String(item.data.excerpt ?? ""),
      slug: item.slug ?? "",
    };
    const seo = {
      title: expandTemplate(text(300).parse(v.title), vars),
      description: expandTemplate(text(1000).parse(v.description), vars),
    };
    blocks = planBlocks(
      await previewChanges(
        ctx,
        actorId,
        [{ collection: c, id, seo, config: {} }],
        "template",
      ),
    );
  } else if (a === "migration-preview") {
    actor(route, 50);
    const raw = migrationSchema.parse(jsonInput(text(48000).parse(v.json)));
    const proposals: Proposal[] = [];
    // File mapping is explicit. No WordPress IDs are assumed to equal EmDash IDs.
    for (const row of raw) {
      const mapped = migrateRow(row, {
        title: "{title}",
        site: ctx.site.name,
        separator: "|",
        excerpt: "{excerpt}",
        slug: "{slug}",
      });
      if (
        mapped.seo.title?.includes("{") ||
        mapped.seo.description?.includes("{")
      ) {
        mapped.warnings.push(
          "Entry-dependent template variables need a separate template preview after migration.",
        );
        delete mapped.seo.title;
        delete mapped.seo.description;
      }
      proposals.push(mapped);
    }
    blocks = planBlocks(
      await previewChanges(ctx, actorId, proposals, "migration"),
    );
  } else if (a === "confirm" || a === "rollback")
    blocks = planBlocks(
      await applyChange(ctx, actorId, uuid.parse(i.value), a === "rollback"),
    );
  else if (a === "prepare-next")
    blocks = planBlocks(await prepareNext(ctx, actorId, uuid.parse(i.value)));
  else if (a === "view-plan") {
    const p = await storage<ChangePlan>(ctx, "changes").get(
      uuid.parse(i.value),
    );
    if (!p) throw new Error("Operation not found");
    blocks = planBlocks(p);
  } else if (a === "redirect-preview" || a === "redirect-import") {
    actor(route, 50);
    const rule = redirectSchema.parse(
      a === "redirect-import"
        ? jsonInput(text(10000).parse(v.json))
        : { ...v, type: Number(v.type) },
    );
    const existing = await ctx.redirects?.list({
      limit: 100,
      search: rule.source,
    });
    const rules = (existing?.items ?? [])
      .filter(
        (r) => r.enabled && !r.isPattern && (r.type === 301 || r.type === 302),
      )
      .map((r) =>
        redirectSchema.parse({
          source: r.source,
          destination: r.destination,
          type: r.type,
        }),
      );
    const issues = redirectIssues([...rules, rule]);
    if (issues.length || existing?.hasMore)
      throw new Error(
        issues.map((x) => `${x.source}: ${x.issue}`).join("; ") ||
          "More matching rules exist. Review in core Redirects first.",
      );
    blocks = [
      header("Review redirect"),
      { type: "code", language: "jsonc", code: JSON.stringify(rule, null, 2) },
      context(
        "Source conflicts checked against matching core rules. Whole-site chains, pattern conflicts and destination HTTP status are not verified.",
      ),
      actions(button("redirect-save", "Create this redirect", rule, true)),
    ];
  } else if (a === "redirect-save") {
    actor(route, 50);
    const rule = redirectSchema.parse(i.value);
    const existing = await ctx.redirects?.list({
      search: rule.source,
      limit: 100,
    });
    if (
      existing?.hasMore ||
      existing?.items.some((r) => r.source === rule.source)
    )
      throw new Error("A matching source now exists; no redirect created");
    if (!ctx.redirects?.create)
      throw new Error("Redirect write capability unavailable");
    await ctx.redirects.create({ ...rule, groupName: "quixseo" });
    return response(await redirectView(ctx), "Native redirect created");
  } else if (a === "redirect-next")
    blocks = await redirectView(
      ctx,
      z.string().check(z.maxLength(4096)).parse(i.value),
    );
  else if (a === "history-next")
    blocks = await history(
      ctx,
      z.string().check(z.maxLength(4096)).parse(i.value),
    );
  else if (a) throw new Error("Unknown action; reload this page");
  else
    switch (i.page) {
      case "/settings":
        blocks = await settingsView(ctx);
        break;
      case "/bulk":
        blocks = await bulkView(ctx);
        break;
      case "/migration":
        blocks = [
          header("Migrate WordPress SEO metadata"),
          context(
            "Use the local WXR converter documented in docs/migration.md, map each source entry to an EmDash collection and saved ID, then paste a mapped JSON batch. No live WordPress database access is used. Unknown fields are reported and never executed.",
          ),
          form("migration-preview", "Preview mapped import", [
            input(
              "json",
              "Mapped Yoast or Rank Math records (up to 20)",
              "",
              true,
            ),
          ]),
          context(
            "Global settings, PHP-serialized schema and arbitrary template functions require manual mapping. Review warnings before confirmation; history supports conditional rollback.",
          ),
        ];
        break;
      case "/redirects":
        blocks = await redirectView(ctx);
        break;
      case "/history":
        blocks = await history(ctx);
        break;
      default: {
        const latest = await storage<AuditJob>(ctx, "jobs").query({
          limit: 1,
          orderBy: { createdAt: "desc" },
        });
        blocks = [
          header("QuixSEO"),
          section("Complete SEO Toolkit for EmDash"),
          context("EmQuix · Free, with no account or paid features"),
          actions(
            button("audit-start", "Start a new site review"),
            button("audit-history", "Previous site reviews"),
          ),
          ...(latest.items[0]
            ? auditBlocks(latest.items[0].data)
            : [
                {
                  type: "empty" as const,
                  title: "Your first SEO review",
                  description:
                    "Configure site identity, enable SEO on your collections, then analyze actual published content. No scores exist until a review runs.",
                },
              ]),
        ];
      }
    }
  return response(blocks);
}
async function history(ctx: PluginContext, cursor?: string): Promise<Block[]> {
  const page = await storage<ChangePlan>(ctx, "changes").query({
    limit: 10,
    cursor,
    orderBy: { createdAt: "desc" },
  });
  return [
    header("Change history"),
    {
      type: "table",
      page_action_id: "history-page",
      columns: [
        { key: "time", label: "Created" },
        { key: "title", label: "Content" },
        { key: "kind", label: "Operation" },
        { key: "status", label: "Rows" },
        { key: "view", label: "Review", format: "element" },
      ],
      rows: page.items.map(({ data: p }) => ({
        time: p.createdAt,
        title: p.rows.map((r) => r.entryTitle || "Untitled entry").join(", "),
        kind: p.kind,
        status: p.rows.map((r) => r.status).join(", "),
        view: button("view-plan", "View change", p.id),
      })),
      empty_text: "No QuixSEO operations yet",
    },
    ...(page.hasMore
      ? [actions(button("history-next", "Older operations", page.cursor))]
      : []),
  ];
}

/** Recover editable forms only; permission and confirmation failures stay closed. */
export async function admin(
  route: SandboxedRouteContext,
  ctx: PluginContext,
): Promise<BlockResponse> {
  const recovery: Record<string, { page: string; role: number }> = {
    "save-settings": { page: "/settings", role: 50 },
    "save-llms": { page: "/settings", role: 50 },
    "bulk-filter": { page: "/bulk", role: 40 },
    "bulk-preview": { page: "/bulk", role: 40 },
    "template-preview": { page: "/bulk", role: 40 },
    "migration-preview": { page: "/migration", role: 50 },
    "redirect-preview": { page: "/redirects", role: 50 },
    "redirect-import": { page: "/redirects", role: 50 },
  };
  const interaction = interactionSchema.parse(route.input);
  const action = interaction.action_id ?? "";
  const target = Object.hasOwn(recovery, action) ? recovery[action] : undefined;
  actor(route, target?.role ?? 40);
  try {
    return await renderAdmin(route, ctx);
  } catch (error) {
    if (!target) throw error;
    const submitted = z
      .record(
        z.string(),
        z.union([z.string().check(z.maxLength(48000)), z.boolean()]),
      )
      .safeParse(interaction.values);
    if (!submitted.success) throw error;
    const panel = await renderAdmin(
      { ...route, input: { type: "page_load", page: target.page } },
      ctx,
    );
    for (const block of panel.blocks) {
      if (
        block.type !== "form" ||
        block.submit.action_id !== interaction.action_id
      )
        continue;
      // Recovered initial values need a fresh Block Kit field group, otherwise
      // the host retains uncontrolled input state from the preceding response.
      block.block_id = `${interaction.action_id}:retry:${crypto.randomUUID()}`;
      for (const field of block.fields) {
        const value = submitted.data[field.action_id];
        if (
          (field.type === "text_input" || field.type === "select") &&
          typeof value === "string"
        )
          field.initial_value = value;
        if (field.type === "toggle" && typeof value === "boolean")
          field.initial_value = value;
      }
    }
    panel.blocks.unshift({
      type: "banner",
      variant: "error",
      title: "Review your submission",
      description: validationMessage(error),
    });
    panel.toast = {
      type: "error",
      message:
        "This submission was not saved. Correct the retained values and try again.",
    };
    return panel;
  }
}

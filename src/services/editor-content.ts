import type { PluginContext } from "emdash/plugin";
import { z } from "#validation";
import { analyze } from "../domain/analysis.js";
import { analysisUrls } from "../domain/urls.js";
import { bodyOf, entryConfig, getEntry, settings, titleOf } from "./context.js";

const snapshotSchema = z.looseObject({
  collection: z.string(),
  entryId: z.string(),
  fields: z.record(z.string(), z.unknown()),
});
export async function editorContent(
  ctx: PluginContext,
  ref: {
    collection: string;
    id: string;
  },
  snapshot?: unknown,
) {
  const [item, config, site, collection, publicUrl] = await Promise.all([
    getEntry(ctx, ref.collection, ref.id),
    entryConfig(ctx, ref.collection, ref.id),
    settings(ctx),
    ctx.schema?.getCollection(ref.collection),
    ctx.content?.getPublicUrl?.(ref.collection, ref.id),
  ]);
  let source =
    item.status === "published"
      ? "Published content"
      : "Saved draft — unpublished changes";
  let data = item.data;
  let warning = "";
  let detail = "";
  const bodyField =
    collection?.fields.find((f) => f.type === "portableText")?.slug ??
    ("content" in data ? "content" : "body");
  const titleField = collection?.titleField || "title";
  let bodyAvailable = true;
  if (snapshot !== undefined) {
    const draft = snapshotSchema.parse(snapshot);
    if (draft.collection !== ref.collection || draft.entryId !== ref.id)
      throw new Error("Editor snapshot belongs to another entry");
    source = "Current editor — unsaved changes";
    data = { ...data, ...draft.fields };
    bodyAvailable = Object.hasOwn(draft.fields, bodyField);
    if (!bodyAvailable)
      warning = `The editor snapshot does not include ${bodyField}. Its current body cannot be assessed. Add that field to the panel's declared draft selector or make it translatable.`;
    if (!Object.hasOwn(draft.fields, titleField))
      warning += " The current title is unavailable; the saved title is used.";
  } else if (
    item.draftRevisionId &&
    item.draftRevisionId !== item.liveRevisionId
  ) {
    const fallback =
      item.status === "published"
        ? "Published content"
        : "Saved content fallback";
    source = fallback;
    if (ctx.content?.getRevision) {
      try {
        const revision = await ctx.content.getRevision(
          ref.collection,
          ref.id,
          item.draftRevisionId,
        );
        if (
          revision &&
          revision.id === item.draftRevisionId &&
          revision.collection === ref.collection &&
          revision.entryId === ref.id
        ) {
          data = revision.data;
          source = "Saved draft — unpublished changes";
        } else
          warning = `The saved draft revision is unavailable. Showing ${fallback.toLowerCase()} instead; these are not the latest editor changes.`;
      } catch (error) {
        warning = `The saved draft could not be read. Showing ${fallback.toLowerCase()} instead; refresh to retry.`;
        detail =
          error instanceof Error ? error.message : "Revision read failed";
      }
    } else
      warning = `Draft revision access is unavailable. Showing ${fallback.toLowerCase()} instead. Approve the content:revisions:read permission when updating QuixSEO.`;
  }
  const selected = { ...item, data };
  const title = titleOf(selected, titleField);
  const urls = analysisUrls(ctx.site.url, publicUrl);
  // Draft snapshots do not attest a public route or unsaved native SEO fields.
  const analysis = analyze({
    title: item.seo?.title || title,
    description: item.seo?.description || String(data.excerpt ?? ""),
    titleSource: item.seo?.title ? "saved" : "content",
    descriptionSource: item.seo?.description
      ? "saved"
      : data.excerpt
        ? "excerpt"
        : "missing",
    url: source === "Published content" ? urls.page : null,
    siteUrl: urls.origin,
    body: bodyAvailable ? bodyOf(selected, bodyField) : undefined,
    keyphrases: config.keyphrases,
    locale: item.locale || ctx.site.locale,
    readability: site.readability,
    language: site.language,
  });
  return {
    item,
    config,
    site,
    collection,
    title,
    urls,
    analysis,
    source,
    warning,
    detail,
    data,
  };
}

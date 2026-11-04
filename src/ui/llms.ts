import type { Block } from "@emdash-cms/blocks";
import type { PluginContext } from "emdash/plugin";
import { LLMS_COLLECTION_LIMIT, LLMS_ENTRY_LIMIT } from "../domain/llms.js";
import { generateLlms, llmsSettings, llmsUrls } from "../services/llms.js";
import {
  actions,
  button,
  context,
  form,
  header,
  input,
  pageLink,
  toggle,
} from "./components.js";

export async function llmsBlocks(ctx: PluginContext): Promise<Block[]> {
  const config = await llmsSettings(ctx),
    urls = llmsUrls(ctx.site.url);
  return [
    header("llms.txt"),
    context(
      "An optional Markdown guide to selected public pages for tools that support llms.txt. It does not guarantee AI visibility or rankings, grant training permission, or override robots.txt.",
    ),
    form("save-llms", "Save llms.txt settings", [
      toggle("enabled", "Enable public llms.txt generation", config.enabled),
      input("summary", "Public site summary (optional)", config.summary, true),
      input(
        "collections",
        "Collections to include, comma separated (empty = all visible SEO-enabled collections)",
        config.collections.join(","),
      ),
    ]),
    context(
      `Each generation checks at most ${LLMS_ENTRY_LIMIT} published entries across ${LLMS_COLLECTION_LIMIT} collections, ordered by collection slug then newest creation date. Noindex entries, noncanonical URLs and hidden collections are excluded. It lists page titles and URLs, never body text or drafts. Choose collections to keep the guide focused.`,
    ),
    actions(button("llms-preview", "Preview llms.txt")),
    ...(!urls
      ? [
          {
            type: "banner" as const,
            variant: "alert" as const,
            title: "Site URL not configured",
            description:
              "Configure your Site URL in EmDash → Settings before enabling or previewing llms.txt.",
          },
        ]
      : []),
    ...(config.enabled && urls
      ? [
          actions(
            {
              type: "link" as const,
              label: "Open generated file",
              target: { kind: "external" as const, url: urls.endpoint },
            },
            {
              type: "link" as const,
              label: "Download llms.txt",
              target: {
                kind: "external" as const,
                url: `${urls.endpoint}?download=1`,
              },
            },
          ),
        ]
      : []),
    context(
      "EmDash sandbox routes live under /_emdash/api/plugins/. To serve /llms.txt, add the documented site route or upload the downloaded file to your site's public root. Downloaded copies do not update or disappear when this toggle changes.",
    ),
    actions({
      type: "link",
      label: "Root URL and robots.txt setup",
      target: {
        kind: "external",
        url: "https://github.com/emquix-com/QuixSEO/blob/main/docs/llms-txt.md",
      },
    }),
    {
      type: "accordion",
      label: "robots.txt reference (manual setup)",
      blocks: [
        context(
          "EmDash 1.4 has no sandbox hook for changing robots.txt. After /llms.txt is working, append this comment in EmDash → Settings → SEO without replacing your existing rules. There is no standard Llms: directive. A comment is informational and does not change crawler access. Core normally blocks /_emdash/, so the API URL is not a substitute for the root route.",
        ),
        ...(urls
          ? [
              {
                type: "code" as const,
                code: `# llms.txt: ${urls.root}`,
              },
            ]
          : []),
      ],
    },
  ];
}
export async function llmsPreview(ctx: PluginContext): Promise<Block[]> {
  const config = await llmsSettings(ctx),
    generated = await generateLlms(ctx, config);
  return [
    header("llms.txt preview"),
    actions(pageLink("/settings", "Back to settings")),
    context(
      `${config.enabled ? "Public generation enabled" : "Preview only — public generation is disabled"}. ${generated.scanned} entries checked; ${generated.included} links included; ${generated.skipped} excluded. This is generated from saved settings.`,
    ),
    ...(generated.truncated
      ? [
          {
            type: "banner" as const,
            variant: "alert" as const,
            title: "Selected pages only",
            description:
              "This generation reached a collection, entry or file-size limit. Narrow the included collections to change the selection; this is not a complete site index.",
          },
        ]
      : []),
    { type: "code", code: generated.text },
  ];
}

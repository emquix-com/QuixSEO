import type { Block } from "@emdash-cms/blocks";
import { redirectRowLimit } from "../domain/redirect-import.js";
import type { currentRedirectImport } from "../services/redirect-import.js";
import { actions, button, context, form, input } from "./components.js";

export function redirectImportBlocks(
  plan: Awaited<ReturnType<typeof currentRedirectImport>>,
): Block[] {
  const blocks: Block[] = [];
  if (!plan) {
    return [
      context(
        `Paste up to ${redirectRowLimit} rows with source,destination,type and optional enabled and pattern columns. Use site-relative paths. Leave destination blank for 410 and 451.`,
      ),
      form("redirect-csv-preview", "Review CSV", [
        input("csv", "Redirect CSV", "", true),
      ]),
    ];
  }
  const done = plan.results.length === plan.rows.length;
  const running = plan.lease > Date.now();
  const conflict = !plan.approved && plan.preview.includes("Conflict");
  blocks.push(
    context(
      plan.approved
        ? `${plan.results.length} of ${plan.rows.length} rules processed.`
        : "Review the rules below. EmDash checks the current rules and redirect loops as each row is applied.",
    ),
    {
      type: "table",
      page_action_id: "redirect-import-rows",
      columns: [
        { key: "line", label: "Line" },
        { key: "source", label: "Source" },
        { key: "destination", label: "Destination" },
        { key: "type", label: "HTTP status" },
        { key: "enabled", label: "Enabled" },
        { key: "result", label: "Result" },
      ],
      rows: plan.rows.map((row, index) => ({
        line: row.line,
        source: row.source,
        destination: row.destination || "—",
        type: row.type,
        enabled: row.enabled ? "Yes" : "No",
        result:
          plan.results[index] ??
          (plan.approved
            ? "Pending"
            : (plan.preview[index] ?? "Check on apply")),
      })),
    },
  );
  if (plan.error)
    blocks.push({
      type: "banner",
      variant: "error",
      title: "Import paused",
      description: plan.error,
    });
  if (conflict)
    blocks.push(
      context(
        "Resolve conflicting sources in EmDash Redirects, then review the CSV again.",
      ),
    );
  if (running)
    return [
      ...blocks,
      context("A batch is running. Reload Redirects to check its progress."),
    ];
  return [
    ...blocks,
    actions(
      ...(!done && !conflict
        ? [
            button(
              "redirect-csv-apply",
              plan.error
                ? "Retry import"
                : plan.approved
                  ? "Continue import"
                  : "Start import",
              plan.id,
              plan.approved
                ? false
                : "Create the reviewed redirects in batches? Existing rules are kept.",
            ),
          ]
        : []),
      button(
        "redirect-csv-close",
        "Close import",
        plan.id,
        plan.approved && !done
          ? "Close this import? Rules already created will stay in EmDash."
          : false,
      ),
    ),
  ];
}

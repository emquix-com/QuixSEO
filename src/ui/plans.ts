import type { Block } from "@emdash-cms/blocks";
import { stableJson } from "../domain/validation.js";
import type { ChangePlan } from "../services/changes.js";
import { actions, button, context, header } from "./components.js";
export function planBlocks(plan: ChangePlan): Block[] {
  const nativeBlocked = plan.rows.some(
    (r) => stableJson(r.beforeSeo) !== stableJson(r.afterSeo),
  );
  return [
    header(`${plan.kind} · Review changes`),
    context(
      `Confirmed QuixSEO settings affect published pages immediately. Operation ${plan.id}. Prepared ${plan.rows.length}; remaining ${plan.queued.length}. Native title, description, canonical, image and indexing edits must be saved in EmDash’s SEO panel. QuixSEO 0.1 cannot write those fields through the sandbox.`,
    ),
    ...plan.rows.flatMap((r): Block[] => [
      {
        type: "fields",
        fields: [
          { label: "Entry", value: `${r.collection}/${r.id}` },
          { label: "Status", value: r.status },
          { label: "Warnings", value: r.warnings?.join("; ") || "None" },
          ...(r.error ? [{ label: "Error", value: r.error }] : []),
        ],
      },
      {
        type: "columns",
        columns: [
          [
            {
              type: "code",
              language: "jsonc",
              code: JSON.stringify({
                seo: r.beforeSeo,
                quixseo: r.beforeConfig,
              }),
            },
          ],
          [
            {
              type: "code",
              language: "jsonc",
              code: JSON.stringify({ seo: r.afterSeo, quixseo: r.afterConfig }),
            },
          ],
        ],
      },
    ]),
    plan.queued.length
      ? actions(button("prepare-next", "Prepare next entry", plan.id))
      : nativeBlocked
        ? {
            type: "banner",
            variant: "alert",
            title: "Native SEO changes require the core SEO panel",
            description:
              "This plan is preview-only because it changes native SEO fields. Nothing will be applied. Copy native values into the core SEO panel, then prepare a separate QuixSEO-only plan.",
          }
        : actions(
            button("confirm", "Confirm and apply next entry", plan.id, true),
            button("rollback", "Revert next unchanged result", plan.id, true),
          ),
    context(
      "One entry per step keeps operations resumable within sandbox limits. Reapplying a completed operation is a no-op. Rollback stops if either native SEO or QuixSEO data has changed.",
    ),
  ];
}

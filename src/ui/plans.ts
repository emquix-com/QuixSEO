import type { Block } from "@emdash-cms/blocks";
import { stableJson } from "../domain/validation.js";
import type { ChangePlan, ChangeRow } from "../services/changes.js";
import {
  actions,
  button,
  context,
  header,
  pageLink,
  section,
} from "./components.js";

export interface ReviewedField {
  label: string;
  before: string;
  after: string;
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length ? value.map(readableValue).join("; ") : "None";
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(
        ([key, v]) => `${key.replace(/([A-Z])/gu, " $1")}: ${readableValue(v)}`,
      );
    return parts.length ? parts.join("; ") : "Not set";
  }
  return String(value);
}

/** Compare saved before/after snapshots; never trust a client-provided diff. */
export function reviewedFields(row: ChangeRow): ReviewedField[] {
  const changes: ReviewedField[] = [];
  const add = (label: string, before: unknown, after: unknown) => {
    if (stableJson(before) === stableJson(after)) return;
    changes.push({
      label,
      before: readableValue(before),
      after: readableValue(after),
    });
  };

  add("SEO title (EmDash)", row.beforeSeo.title, row.afterSeo.title);
  add(
    "Meta description (EmDash)",
    row.beforeSeo.description,
    row.afterSeo.description,
  );
  add(
    "Canonical URL (EmDash)",
    row.beforeSeo.canonical,
    row.afterSeo.canonical,
  );
  add("Native social image (EmDash)", row.beforeSeo.image, row.afterSeo.image);
  add(
    "Hide from search engines (EmDash)",
    row.beforeSeo.noIndex,
    row.afterSeo.noIndex,
  );

  add(
    "Focus keyphrases",
    row.beforeConfig.keyphrases,
    row.afterConfig.keyphrases,
  );
  add(
    "Cornerstone content",
    row.beforeConfig.cornerstone,
    row.afterConfig.cornerstone,
  );
  add("Nofollow links", row.beforeConfig.noFollow, row.afterConfig.noFollow);
  add(
    "Suppress snippets",
    row.beforeConfig.noSnippet,
    row.afterConfig.noSnippet,
  );
  add("Open Graph title", row.beforeConfig.ogTitle, row.afterConfig.ogTitle);
  add(
    "Open Graph description",
    row.beforeConfig.ogDescription,
    row.afterConfig.ogDescription,
  );
  add("Open Graph image", row.beforeConfig.ogImage, row.afterConfig.ogImage);
  add(
    "X / Twitter title",
    row.beforeConfig.twitterTitle,
    row.afterConfig.twitterTitle,
  );
  add(
    "X / Twitter description",
    row.beforeConfig.twitterDescription,
    row.afterConfig.twitterDescription,
  );
  add(
    "X / Twitter image",
    row.beforeConfig.twitterImage,
    row.afterConfig.twitterImage,
  );

  const beforeSchema = row.beforeConfig.schema;
  const afterSchema = row.afterConfig.schema;
  add("Structured data enabled", Boolean(beforeSchema), Boolean(afterSchema));
  const schemaLabels = {
    type: "Schema type",
    name: "Schema name",
    description: "Schema description",
    author: "Author",
    image: "Schema image",
    sku: "Product SKU",
    price: "Price",
    currency: "Currency",
    availability: "Availability",
    street: "Street address",
    city: "City",
    country: "Country",
    telephone: "Telephone",
    questions: "FAQ questions and answers",
    breadcrumbs: "Breadcrumbs",
    visibleContentConfirmed: "Visible content confirmed",
  } as const;
  for (const [key, label] of Object.entries(schemaLabels) as Array<
    [keyof typeof schemaLabels, string]
  >) {
    add(label, beforeSchema?.[key], afterSchema?.[key]);
  }

  return changes;
}

export function planBlocks(
  plan: ChangePlan,
  surface: "editor" | "page" = "page",
): Block[] {
  const single = plan.rows.length + plan.queued.length === 1;
  const labelStatus = (s: string) =>
    s === "rolled-back" ? "Reverted" : s.charAt(0).toUpperCase() + s.slice(1);
  const nativeBlocked = plan.rows.some(
    (row) => stableJson(row.beforeSeo) !== stableJson(row.afterSeo),
  );
  const pending = plan.rows.some(
    (row) => row.status === "pending" || row.status === "applying",
  );
  const reversible = plan.rows.some(
    (row) => row.status === "applied" || row.status === "reverting",
  );
  const blocks: Block[] = [
    header(
      pending || plan.queued.length
        ? "Review changes"
        : plan.rows.every((r) => r.status === "rolled-back")
          ? "Change reverted"
          : plan.rows.every((r) => r.status === "applied")
            ? "Change applied"
            : "Change details",
    ),
    context(
      pending || plan.queued.length
        ? `Review the proposed changes. ${plan.rows.length} prepared; ${plan.queued.length} waiting. Applying QuixSEO metadata to published content takes effect immediately.`
        : "The original before/after comparison is retained below as change history.",
    ),
  ];

  if (surface === "page")
    blocks.splice(
      1,
      0,
      actions(pageLink("/history", "Back to change history")),
    );

  for (const row of plan.rows) {
    const changes = reviewedFields(row);
    const entryName = row.entryTitle || "Untitled entry";
    const changeLabel = changes.length === 1 ? "change" : "changes";
    const summary: Block[] = [
      section(
        `Content type: ${row.collection.charAt(0).toUpperCase() + row.collection.slice(1).replace(/[_-]/gu, " ")}`,
      ),
      section(`Status: ${labelStatus(row.status)}`),
      section(`Warnings: ${row.warnings?.join("; ") || "None"}`),
    ];
    const details: Block[] = [];
    if (row.error) {
      details.push({
        type: "banner",
        variant: "error",
        description: row.error,
      });
    }
    if (changes.length === 0) {
      details.push(context("No field values changed."));
    } else {
      for (const change of changes) {
        details.push(
          section(change.label),
          context(`Before: ${change.before}`),
          context(`After: ${change.after}`),
          { type: "divider" },
        );
      }
    }
    blocks.push({
      type: "accordion",
      label: `${entryName} · ${labelStatus(row.status)} · ${changes.length} ${changeLabel}`,
      default_open: true,
      blocks:
        surface === "editor"
          ? [
              ...summary,
              ...details,
              {
                type: "accordion",
                label: "Entry details",
                blocks: [context(`Entry ID: ${row.id}`)],
              },
            ]
          : [
              {
                type: "columns",
                columns: [
                  details,
                  [
                    ...summary,
                    {
                      type: "accordion",
                      label: "Entry details",
                      blocks: [context(`Entry ID: ${row.id}`)],
                    },
                  ],
                ],
              },
            ],
    });
  }

  if (plan.queued.length) {
    blocks.push(actions(button("prepare-next", "Prepare next entry", plan.id)));
  } else if (nativeBlocked) {
    blocks.push({
      type: "banner",
      variant: "alert",
      title: "Native SEO changes require EmDash",
      description:
        "This preview cannot be applied. Save SEO title, description, canonical, image and indexing in EmDash's SEO panel, then prepare a QuixSEO-only change.",
    });
  } else if (pending || reversible) {
    const options = [];
    if (pending)
      options.push(
        button(
          "confirm",
          single ? "Apply changes" : "Apply next entry",
          plan.id,
          true,
        ),
      );
    if (reversible)
      options.push(
        button(
          "rollback",
          single ? "Revert change" : "Revert next unchanged result",
          plan.id,
          true,
        ),
      );
    blocks.push(actions(...options));
  } else {
    blocks.push(context("This operation has no outstanding changes."));
  }

  blocks.push(
    context("Reverting stops if saved values changed since this operation."),
    {
      type: "accordion",
      label: "Operation details",
      blocks: [context(`Operation reference: ${plan.id}`)],
    },
  );
  return blocks;
}

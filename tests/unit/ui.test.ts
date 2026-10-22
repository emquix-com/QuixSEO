import { describe, expect, it } from "vitest";
import type { Analysis } from "../../src/domain/analysis.js";
import {
  emptySeo,
  entryConfigSchema,
  schemaConfig,
} from "../../src/domain/validation.js";
import type { ChangePlan, ChangeRow } from "../../src/services/changes.js";
import { analysisBlocks } from "../../src/ui/components.js";
import { planBlocks, reviewedFields } from "../../src/ui/plans.js";

function sampleRow(status: ChangeRow["status"] = "pending"): ChangeRow {
  const beforeConfig = entryConfigSchema.parse({
    keyphrases: ["woocommerce checkout"],
  });
  return {
    collection: "posts",
    id: "sample-entry",
    entryTitle: "How to Improve WooCommerce Checkout Conversion",
    seo: {},
    config: {},
    beforeSeo: { ...emptySeo },
    afterSeo: { ...emptySeo },
    beforeConfig,
    afterConfig: {
      ...beforeConfig,
      ogTitle: "Improve Your WooCommerce Checkout",
    },
    configRevision: "version",
    status,
  };
}

function samplePlan(row: ChangeRow): ChangePlan {
  return {
    id: "operation-id",
    actor: "test-author",
    createdAt: "2026-10-22T09:00:00Z",
    kind: "editor",
    rows: [row],
    queued: [],
    confirmed: false,
    lease: 0,
  };
}

describe("nontechnical change review", () => {
  it("shows only changed fields with readable previous/proposed values", () => {
    const row = sampleRow();
    expect(reviewedFields(row)).toEqual([
      {
        label: "Open Graph title",
        before: "Not set",
        after: "Improve Your WooCommerce Checkout",
      },
    ]);
    const blocks = planBlocks(samplePlan(row));
    const text = JSON.stringify(blocks);
    expect(text).toContain("How to Improve WooCommerce Checkout Conversion");
    expect(text).toContain("Before: Not set");
    expect(text).toContain("After: Improve Your WooCommerce Checkout");
    expect(text).not.toContain('"type":"code"');
    expect(text).not.toContain('"type":"columns"');
    expect(text).not.toContain("Before: woocommerce checkout");
  });

  it("shows semantic schema fields, not raw JSON", () => {
    const row = sampleRow();
    row.afterConfig = {
      ...row.afterConfig,
      schema: schemaConfig.parse({ type: "BlogPosting", author: "Alex" }),
    };
    const diffs = reviewedFields(row);
    expect(diffs).toContainEqual({
      label: "Schema type",
      before: "Not set",
      after: "BlogPosting",
    });
    expect(diffs).toContainEqual({
      label: "Author",
      before: "Not set",
      after: "Alex",
    });
  });

  it("hides action buttons once a change is rolled back", () => {
    const blocks = planBlocks(samplePlan(sampleRow("rolled-back")));
    expect(JSON.stringify(blocks)).not.toContain('"action_id":"confirm"');
    expect(JSON.stringify(blocks)).not.toContain('"action_id":"rollback"');
  });

  it("preserves the native SEO write safety banner", () => {
    const row = sampleRow();
    row.afterSeo = { ...row.beforeSeo, title: "New SEO title" };
    const text = JSON.stringify(planBlocks(samplePlan(row)));
    expect(text).toContain("Native SEO changes require EmDash");
    expect(text).not.toContain('"action_id":"confirm"');
  });
});

describe("compact status indicators", () => {
  it("uses colored symbols, without color names, for every checklist state", () => {
    const analysis: Analysis = {
      score: 50,
      readabilityScore: 50,
      wordCount: 10,
      internal: [],
      external: [],
      missingAlt: 0,
      readingEase: null,
      coverage: [],
      checks: (["good", "improve", "problem", "unsupported"] as const).map(
        (status) => ({
          id: status,
          status,
          message: "Advice",
          weight: 1,
          category: "seo" as const,
        }),
      ),
    };
    const blocks = analysisBlocks(analysis);
    const table = blocks.find((block) => block.type === "table");
    expect(table?.type).toBe("table");
    if (table?.type !== "table") return;
    expect(table.rows.map((row) => row.status)).toEqual([
      "🟢",
      "🟠",
      "🔴",
      "⚪",
    ]);
  });
});

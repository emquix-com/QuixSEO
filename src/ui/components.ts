import type {
  ActionElement,
  Block,
  BlockResponse,
  FormField,
} from "@emdash-cms/blocks";
import type { Analysis } from "../domain/analysis.js";
export const header = (text: string): Block => ({ type: "header", text });
export const context = (text: string): Block => ({ type: "context", text });
export const section = (text: string): Block => ({ type: "section", text });
export const input = (
  id: string,
  label: string,
  value = "",
  multiline = false,
): FormField => ({
  type: "text_input",
  action_id: id,
  label,
  initial_value: value,
  multiline,
});
export const toggle = (
  id: string,
  label: string,
  value: boolean,
): FormField => ({
  type: "toggle",
  action_id: id,
  label,
  initial_value: value,
});
export const select = (
  id: string,
  label: string,
  values: string[],
  value: string,
): FormField => ({
  type: "select",
  action_id: id,
  label,
  options: values.map((v) => ({ label: v, value: v })),
  initial_value: value,
});
export const form = (
  id: string,
  label: string,
  fields: FormField[],
): Block => ({
  type: "form",
  block_id: id,
  fields,
  submit: { label, action_id: id },
});
export const button = (
  id: string,
  label: string,
  value?: unknown,
  confirm: boolean | string = false,
): ActionElement => ({
  type: "button",
  action_id: id,
  label,
  value,
  ...(confirm
    ? {
        confirm: {
          title: label,
          text:
            typeof confirm === "string"
              ? confirm
              : "Apply the reviewed change to saved data? This does not publish content.",
          confirm: "Confirm",
          deny: "Cancel",
        },
      }
    : {}),
});
export const actions = (...elements: ActionElement[]): Block => ({
  type: "actions",
  elements,
});
export const editLink = (
  collection: string,
  id: string,
  locale?: string,
): ActionElement => ({
  type: "link",
  label: "Edit entry",
  target: { kind: "content", collection, id, ...(locale ? { locale } : {}) },
});
export const pageLink = (path: string, label: string): ActionElement => ({
  type: "link",
  label,
  target: { kind: "plugin-page", path },
});
export const response = (blocks: Block[], message?: string): BlockResponse => ({
  blocks,
  ...(message ? { toast: { type: "success" as const, message } } : {}),
});
export function analysisBlocks(a: Analysis): Block[] {
  // EmDash 1.3.1 renders neutral Block Kit badges without custom variants.
  // Accessible labels plus a colored marker stay readable in narrow editors.
  const label = {
    good: "🟢 Passed",
    improve: "🟠 Review",
    problem: "🔴 Fix",
    unsupported: "⚪ N/A",
  };
  return [
    {
      type: "stats",
      items: [
        {
          label: a.checks.some(
            (c) => c.category === "seo" && c.reason === "unavailable",
          )
            ? "SEO editorial checks (partial)"
            : "SEO editorial checks",
          value: a.score === null ? "Not scored" : `${a.score}/100`,
        },
        {
          label: "Readability",
          value:
            a.readabilityScore === null
              ? "Not scored"
              : `${a.readabilityScore}/100`,
        },
        {
          label: "Internal / external links",
          value: a.linksAssessed
            ? `${a.internal.length} / ${a.external.length}`
            : "Not fully assessed",
        },
      ],
    },
    context(
      "This score summarizes automated editorial checks, not topical depth, factual accuracy or search rankings. Keyphrase guidance is unscored. Passing optional diagnostics adds no points.",
    ),
    context(
      `Automated check coverage: ${a.assessment.assessed} assessed · ${a.assessment.unavailable} unavailable · ${a.assessment.notApplicable} not applicable. N/A earns no points. ${a.assessment.unavailable ? "Partial analysis — compare scores only when the same checks are available." : "Human review of usefulness and accuracy is still needed."}`,
    ),
    {
      type: "table",
      page_action_id: "checks",
      columns: [
        { key: "status", label: "Status", format: "badge" },
        { key: "message", label: "Recommendation" },
      ],
      rows: a.checks.map((c) => ({
        status: label[c.status],
        message:
          c.status === "unsupported"
            ? `${c.reason === "unavailable" ? "Unavailable" : "Not applicable"}: ${c.message}`
            : c.message,
      })),
      empty_text: "No applicable checks",
    },
    ...(a.coverage.length
      ? [
          {
            type: "banner" as const,
            variant: "alert" as const,
            title: "Analysis coverage",
            description: a.coverage.join(", "),
          },
        ]
      : []),
  ];
}

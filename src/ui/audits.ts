import type { Block } from "@emdash-cms/blocks";
import type { PluginContext } from "emdash/plugin";
import type { AuditJob, AuditRecord } from "../services/audit.js";
import { relatedCandidates } from "../services/audit.js";
import { storage } from "../services/context.js";
import {
  actions,
  button,
  context,
  editLink,
  form,
  header,
  pageLink,
  section,
  select,
} from "./components.js";

export function auditStatus(job: AuditJob): string {
  if (job.phase === "complete") return "Completed";
  if (job.phase === "cancelled") return "Cancelled";
  if (job.phase === "failed") return "Failed or interrupted";
  if (
    job.error ||
    (job.background &&
      job.lastProgressAt &&
      Date.now() - Date.parse(job.lastProgressAt) > 180000)
  )
    return "Failed or interrupted";
  return job.phase === "scan" ? "Scanning content" : "Assessing findings";
}
export function auditBlocks(job: AuditJob): Block[] {
  const active = job.phase === "scan" || job.phase === "assess";
  const status = auditStatus(job),
    n = job.counts;
  return [
    header("Site SEO review"),
    section(status),
    context(
      `Started ${job.createdAt}. ${job.processed} entries scanned · ${job.assessed} assessed. Audits review published content; unpublished editor revisions are excluded.`,
    ),
    {
      type: "stats",
      items: [
        {
          label: job.incompleteAnalyses
            ? "Site checklist average (partial)"
            : "Site checklist average",
          value:
            job.phase === "complete" && job.scored
              ? `${Math.round(job.scoreTotal / job.scored)}/100`
              : job.phase === "complete"
                ? "Not scored"
                : "Available after completion",
        },
        {
          label: "Entries requiring attention",
          value: job.attention ?? "Not recorded",
        },
      ],
    },
    {
      type: "columns",
      columns: [
        [
          section("Search metadata"),
          context(
            `Missing explicit titles: ${n.missingTitle} · descriptions: ${n.missingDescription}`,
          ),
          context(
            `Duplicate titles: ${n.duplicateTitle} · descriptions: ${n.duplicateDescription}`,
          ),
          context(`Noindex entries: ${n.noIndex}`),
        ],
        [
          section("Internal linking"),
          context(
            `Entries without internal links among assessed bodies: ${n.lowLinks}`,
          ),
          context(
            job.linkCoverageIncomplete
              ? "Incoming links and potentially orphaned content: not assessed because coverage is incomplete."
              : `Potentially orphaned: ${n.orphan}`,
          ),
          context(
            "Potentially orphaned means no incoming links from analyzed content bodies. Navigation, external links and content outside this audit are not included.",
          ),
        ],
      ],
    },
    context(
      `${job.incompleteAnalyses ?? 0} entries have partial analysis. Findings are provisional until all scanning and assessment steps finish. Missing metadata counts concern explicit overrides; themes may provide fallbacks. Scores do not predict rankings.`,
    ),
    ...(active
      ? [
          context(
            job.background
              ? "Background processing is scheduled. You may close this page. Refresh status to see progress; your host must run EmDash scheduled tasks."
              : "Automatic background execution is unavailable. Use Resume audit to process a bounded batch, or ask your host to enable EmDash scheduled tasks.",
          ),
        ]
      : []),
    ...(status === "Failed or interrupted"
      ? [
          {
            type: "banner" as const,
            variant: "alert" as const,
            title: "Audit needs attention",
            description:
              job.phase === "failed"
                ? "Repeated attempts failed. Progress is preserved; resolve the issue and choose Resume audit."
                : job.error
                  ? "A batch was interrupted. Progress is preserved and automatic retries are spaced out. You can resume explicitly."
                  : "No recent progress was reported. Check that the host scheduler is running, then resume the audit.",
          },
        ]
      : []),
    actions(
      button("audit-status", "Refresh status", job.id),
      button("audit-results", "View audit results", job.id),
      ...((active && (!job.background || status === "Failed or interrupted")) ||
      job.phase === "failed"
        ? [button("audit-resume", "Resume audit", job.id)]
        : []),
      ...(active
        ? [
            button(
              "audit-cancel",
              "Cancel audit",
              job.id,
              "Stop this audit? Existing findings will be retained. You can start a new review later.",
            ),
          ]
        : []),
    ),
    {
      type: "accordion",
      label: "Advanced details",
      blocks: [
        context(
          `Audit reference: ${job.id} · scoring model ${job.modelVersion ?? 1}`,
        ),
        ...(job.error || job.schedulingError
          ? [context(`Diagnostic: ${job.error || job.schedulingError}`)]
          : []),
      ],
    },
  ];
}
const summary = (r: AuditRecord) => {
  const fix = r.analysis.checks.filter((c) => c.status === "problem").length;
  const review =
    r.analysis.checks.filter((c) => c.status === "improve").length +
    r.issues.length;
  return { fix, review, unavailable: r.analysis.assessment?.unavailable ?? 0 };
};
export function findingBlocks(r: AuditRecord): Block[] {
  const s = summary(r);
  return [
    context(
      `${s.fix} Fix · ${s.review} Review · ${s.unavailable} unavailable. ${r.analysis.score ?? "Not scored"}${r.analysis.score === null ? "" : "/100"}${s.unavailable ? " (partial analysis)" : ""}`,
    ),
    actions(
      editLink(r.collection, r.contentId, r.locale),
      button(
        "related",
        "Internal link suggestions",
        `${r.job}:${r.collection}:${r.contentId}`,
      ),
    ),
    {
      type: "table",
      page_action_id: "finding-checks",
      columns: [
        { key: "status", label: "Status", format: "badge" },
        { key: "message", label: "Finding" },
      ],
      rows: [
        ...r.issues.map((message) => ({ status: "Review", message })),
        ...r.analysis.checks
          .filter((c) => c.status !== "good")
          .map((c) => ({
            status:
              c.status === "problem"
                ? "Fix"
                : c.status === "improve"
                  ? "Review"
                  : "N/A",
            message: c.message,
          })),
      ],
      empty_text:
        "No findings in the available checks. Human review is still needed.",
    },
    context(
      `Incoming body links: ${r.incoming ?? "Not assessed"}. Potentially orphaned only concerns bodies within this audit, not navigation or external links.`,
    ),
    {
      type: "accordion",
      label: "Advanced details",
      blocks: [
        context(`Entry ID: ${r.contentId}`),
        context(r.url || "Public URL not available"),
      ],
    },
  ];
}
export async function reportsView(
  ctx: PluginContext,
  id: string,
  cursor?: string,
  filter = "all",
  sort = "lowest-score",
): Promise<Block[]> {
  const job = await storage<AuditJob>(ctx, "jobs").get(id);
  if (!job) throw new Error("Audit not found");
  const page = await storage<AuditRecord>(ctx, "reports").query({
    where: { job: id },
    limit: 10,
    cursor,
  });
  const rows = page.items.filter(
    ({ data: r }) =>
      filter === "all" ||
      (filter === "needs-attention"
        ? summary(r).fix + summary(r).review > 0
        : summary(r).unavailable > 0),
  );
  rows.sort((a, b) =>
    sort === "title"
      ? a.data.title.localeCompare(b.data.title)
      : (a.data.analysis.score ?? 101) - (b.data.analysis.score ?? 101),
  );
  return [
    header("SEO audit results"),
    actions(button("audit-status", "Back to audit", id)),
    section(auditStatus(job)),
    context(
      `${job.processed} entries scanned · ${job.assessed} assessed. ${job.phase === "complete" ? "Completed audit snapshot." : "Partial findings; this audit has not completed."}`,
    ),
    form(`reports-filter:${id}`, "Apply page options", [
      select(
        "filter",
        "Show on this page",
        ["all", "needs-attention", "unavailable"],
        filter,
      ),
      select("sort", "Order this page", ["lowest-score", "title"], sort),
    ]),
    context(
      "Filters and ordering apply to this page of up to 10 entries. Continue through pages to review the entire audit.",
    ),
    {
      type: "table",
      page_action_id: "findings-page",
      columns: [
        { key: "title", label: "Article" },
        { key: "score", label: "SEO score" },
        { key: "attention", label: "Findings" },
        { key: "open", label: "Details", format: "element" },
      ],
      rows: rows.map(({ id: recordId, data: r }) => ({
        title: r.title,
        score:
          r.analysis.score === null
            ? "Not scored"
            : `${r.analysis.score}/100${summary(r).unavailable ? " · partial" : ""}`,
        attention: `${summary(r).fix} Fix · ${summary(r).review} Review · ${summary(r).unavailable} unavailable`,
        open: button("audit-entry", "View findings", recordId),
      })),
      empty_text: job.processed
        ? "No matching entries on this page. Try another filter or the next page."
        : "No published entries have been analyzed. Check collection settings or refresh audit progress.",
    },
    ...(rows.length === 1
      ? [
          section(rows[0]?.data.title ?? "Article"),
          {
            type: "columns" as const,
            columns: [
              findingBlocks(rows[0]?.data as AuditRecord),
              [
                context(
                  "Fix highlights detected problems. Review includes optional editorial recommendations. N/A checks do not earn points.",
                ),
              ],
            ],
          },
        ]
      : []),
    ...(page.hasMore
      ? [
          actions(
            button("reports-next", "Next results", {
              id,
              cursor: page.cursor,
              filter,
              sort,
            }),
          ),
        ]
      : []),
  ];
}
export async function suggestionsView(
  ctx: PluginContext,
  recordId: string,
  cursor?: string,
): Promise<Block[]> {
  const source = await storage<AuditRecord>(ctx, "reports").get(recordId);
  if (!source) throw new Error("Audit record not found");
  const page = await storage<AuditRecord>(ctx, "reports").query({
    where: { job: source.job },
    limit: 100,
    cursor,
  });
  const related = relatedCandidates(
    source,
    page.items.map((x) => x.data),
  );
  const sole =
    !cursor &&
    !page.hasMore &&
    page.items.filter(
      ({ data: r }) => r.url && !r.noIndex && r.locale === source.locale,
    ).length <= 1;
  return [
    header("Internal link suggestions"),
    section(source.title),
    actions(button("audit-results", "Back to audit results", source.job)),
    context(
      "Suggestions use title and focus-keyphrase overlap among up to 100 audit entries on this candidate page. These are not globally ranked recommendations. No links are inserted automatically. Review relevance before editing.",
    ),
    ...related.flatMap(({ entry: r }) => [
      section(`${r.title}${r.cornerstone ? " · Cornerstone" : ""}`),
      actions(editLink(r.collection, r.contentId, r.locale)),
    ]),
    ...(!related.length
      ? [
          {
            type: "empty" as const,
            title: "No link suggestions yet",
            description: sole
              ? "This audit contains at most one eligible published article in this language. Add other relevant published pages and run a new audit before requesting suggestions."
              : "No sufficiently relevant candidates were found on this candidate page. Try the next page if available; QuixSEO will not suggest unrelated content just to fill the list.",
          },
        ]
      : []),
    ...(page.hasMore
      ? [
          actions(
            button("related-next", "Search next 100 candidates", {
              id: recordId,
              cursor: page.cursor,
            }),
          ),
        ]
      : []),
  ];
}
export async function auditHistory(
  ctx: PluginContext,
  cursor?: string,
): Promise<Block[]> {
  const page = await storage<AuditJob>(ctx, "jobs").query({
    limit: 10,
    cursor,
    orderBy: { createdAt: "desc" },
  });
  return [
    header("Previous site reviews"),
    actions(pageLink("/dashboard", "Back to overview")),
    {
      type: "table",
      page_action_id: "audits",
      columns: [
        { key: "date", label: "Started" },
        { key: "status", label: "Status" },
        { key: "entries", label: "Entries scanned" },
        { key: "open", label: "Results", format: "element" },
      ],
      rows: page.items.map(({ data: j }) => ({
        date: j.createdAt,
        status: auditStatus(j),
        entries: j.processed,
        open: button("audit-results", "View audit results", j.id),
      })),
      empty_text: "No previous audits",
    },
    ...(page.hasMore
      ? [actions(button("audits-next", "Older audits", page.cursor))]
      : []),
  ];
}

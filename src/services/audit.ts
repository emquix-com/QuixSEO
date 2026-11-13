import type { CronEvent, PluginContext } from "emdash/plugin";
import type { Analysis } from "../domain/analysis.js";
import { analyze } from "../domain/analysis.js";
import { normalize } from "../domain/content.js";
import { validateSchema } from "../domain/schema.js";
import {
  analysisUrls,
  resolveCanonical,
  siteUrlWarning,
} from "../domain/urls.js";
import type { EntryConfig, Settings } from "../domain/validation.js";
import { bodyOf, entryConfig, settings, storage, titleOf } from "./context.js";
export interface AuditRecord {
  job: string;
  collection: string;
  contentId: string;
  title: string;
  titleKey: string;
  descriptionKey: string;
  url: string;
  noIndex: boolean;
  locale: string;
  analysis: Analysis;
  issues: string[];
  cornerstone: boolean;
  keywords: string[];
  incoming: number | null;
}
export interface AuditJob {
  modelVersion?: 2;
  incompleteAnalyses?: number;
  linkCoverageIncomplete?: boolean;
  id: string;
  actor: string;
  createdAt: string;
  phase: "scan" | "assess" | "complete" | "failed" | "cancelled";
  resumePhase?: "scan" | "assess";
  background?: boolean;
  schedulingError?: string;
  lastProgressAt?: string;
  failures?: number;
  nextAttemptAt?: number;
  attention?: number;
  lease: number;
  collections: { slug: string; titleField: string; bodyField: string }[];
  collectionIndex: number;
  cursor?: string;
  settings: Settings;
  processed: number;
  assessed: number;
  scoreTotal: number;
  scored: number;
  counts: {
    missingTitle: number;
    missingDescription: number;
    duplicateTitle: number;
    duplicateDescription: number;
    noIndex: number;
    lowLinks: number;
    orphan: number;
    issues: number;
  };
  error?: string;
}
interface Edge {
  job: string;
  target: string;
  source: string;
}
export async function startAudit(
  ctx: PluginContext,
  actorId: string,
): Promise<AuditJob> {
  const config = await settings(ctx);
  if (!ctx.schema) throw new Error("Schema capability unavailable");
  const collections = (await ctx.schema.listCollections()).filter(
    (c) =>
      c.hasSeo &&
      c.routable &&
      (!config.collections.length || config.collections.includes(c.slug)),
  );
  if (!collections.length)
    throw new Error(
      "Enable SEO and routability on at least one content collection first",
    );
  const job: AuditJob = {
    modelVersion: 2,
    incompleteAnalyses: 0,
    linkCoverageIncomplete: false,
    id: crypto.randomUUID(),
    actor: actorId,
    createdAt: new Date().toISOString(),
    phase: "scan",
    lastProgressAt: new Date().toISOString(),
    attention: 0,
    failures: 0,
    lease: 0,
    collections: collections.map((c) => ({
      slug: c.slug,
      titleField: c.titleField || "title",
      bodyField:
        c.fields.find((f) => f.type === "portableText")?.slug ?? "body",
    })),
    collectionIndex: 0,
    settings: config,
    processed: 0,
    assessed: 0,
    scoreTotal: 0,
    scored: 0,
    counts: {
      missingTitle: 0,
      missingDescription: 0,
      duplicateTitle: 0,
      duplicateDescription: 0,
      noIndex: 0,
      lowLinks: 0,
      orphan: 0,
      issues: 0,
    },
  };
  await storage<AuditJob>(ctx, "jobs").put(job.id, job);
  await enableBackground(ctx, job.id);
  return runAuditBatch(ctx, job.id);
}
export async function stepAudit(
  ctx: PluginContext,
  id: string,
): Promise<AuditJob> {
  const jobs = storage<AuditJob>(ctx, "jobs"),
    stored = await jobs.getVersioned(id);
  if (!stored) throw new Error("Audit not found");
  const baseline = stored.value;
  let job = structuredClone(baseline);
  if (["complete", "cancelled", "failed"].includes(job.phase)) return job;
  if ((job.nextAttemptAt ?? 0) > Date.now()) return job;
  if (job.modelVersion !== 2)
    job = {
      ...job,
      phase: "failed",
      error:
        "This audit used an older scoring model. Start a new site analysis to avoid mixing different scores. Existing reports are retained.",
    };
  if (job.phase === "failed") {
    await jobs.compareAndSet(id, stored.revision, job);
    return job;
  }
  if (job.lease > Date.now()) return job;
  job.lease = Date.now() + 60000;
  const lock = await jobs.compareAndSet(id, stored.revision, job);
  if (!lock.applied) return (await jobs.get(id)) ?? baseline;
  try {
    if (job.phase === "scan") {
      const collection = job.collections[job.collectionIndex];
      if (!collection) {
        job.phase = "assess";
        delete job.cursor;
      } else {
        if (!ctx.content) throw new Error("Content capability unavailable");
        const page = await ctx.content.list(collection.slug, {
          limit: 1,
          cursor: job.cursor,
          where: { status: "published" },
          orderBy: { createdAt: "asc" },
        });
        const item = page.items[0];
        if (item) {
          const key = `${id}:${collection.slug}:${item.id}`;
          let record = await storage<AuditRecord>(ctx, "reports").get(key);
          if (!record) {
            const config: EntryConfig = await entryConfig(
              ctx,
              collection.slug,
              item.id,
            );
            const urls = analysisUrls(
              ctx.site.url,
              await ctx.content.getPublicUrl?.(collection.slug, item.id),
            );
            const url = urls.page ?? "";
            const nativeTitle = item.seo?.title || "",
              description = item.seo?.description || "";
            const title = titleOf(item, collection.titleField);
            const issues: string[] = [];
            if (!urls.site)
              issues.push(
                `${siteUrlWarning.title}. ${siteUrlWarning.description}`,
              );
            if (!url)
              issues.push(
                "Published entry has no resolvable public URL; inspect routability, locale and slug.",
              );
            const canonical = item.seo?.canonical
              ? resolveCanonical(item.seo.canonical, urls)
              : null;
            if (item.seo?.canonical && (!canonical || !url))
              issues.push(
                "Canonical comparison not assessed: a usable canonical and public content URL are required.",
              );
            if (canonical && url && canonical !== url)
              issues.push(
                "Canonical differs from the public URL; verify that consolidation is intentional.",
              );
            if (config.schema) issues.push(...validateSchema(config.schema));
            const analysis = analyze({
              title: nativeTitle || title,
              description: description || String(item.data.excerpt ?? ""),
              titleSource: nativeTitle ? "saved" : "content",
              descriptionSource: description
                ? "saved"
                : item.data.excerpt
                  ? "excerpt"
                  : "missing",
              url: urls.page,
              siteUrl: urls.site,
              body: bodyOf(item, collection.bodyField),
              keyphrases: config.keyphrases,
              locale: item.locale || ctx.site.locale,
              readability: job.settings.readability,
              language: job.settings.language,
            });
            if (analysis.internal.length > 100)
              issues.push(
                "Only the first 100 internal links are indexed for this entry.",
              );
            record = {
              job: id,
              collection: collection.slug,
              contentId: item.id,
              title,
              titleKey: normalize(nativeTitle),
              descriptionKey: normalize(description),
              url,
              noIndex: item.seo?.noIndex ?? false,
              locale: item.locale || ctx.site.locale,
              analysis,
              issues,
              cornerstone: config.cornerstone,
              keywords: config.keyphrases,
              incoming: null,
            };
            const reports = storage<AuditRecord>(ctx, "reports");
            const created = await reports.compareAndSet(key, null, record);
            if (!created.applied) {
              const existing = await reports.get(key);
              if (!existing) throw new Error("Audit snapshot unavailable");
              record = existing;
            }
          }
          const { analysis, url } = record;
          const edges = [...new Set(url ? analysis.internal : [])]
            .slice(0, 100)
            .map((target, i) => ({
              id: `${key}:${i}`,
              data: { job: id, target, source: url },
            }));
          if (edges.length) await storage<Edge>(ctx, "edges").putMany(edges);
          if (analysis.assessment.unavailable)
            job.incompleteAnalyses = (job.incompleteAnalyses ?? 0) + 1;
          if (!analysis.linksAssessed || !url || analysis.internal.length > 100)
            job.linkCoverageIncomplete = true;
          job.processed++;
        }
        if (page.hasMore && page.cursor) job.cursor = page.cursor;
        else {
          job.collectionIndex++;
          delete job.cursor;
          if (job.collectionIndex >= job.collections.length)
            job.phase = "assess";
        }
      }
    } else {
      const reports = storage<AuditRecord>(ctx, "reports");
      const page = await reports.query({
        where: { job: id },
        limit: 1,
        cursor: job.cursor,
      });
      const row = page.items[0];
      if (row) {
        const r = row.data;
        const duplicateTitle = r.titleKey
          ? (
              await reports.query({
                where: { job: id, titleKey: r.titleKey },
                limit: 2,
              })
            ).items.length > 1
          : false;
        const duplicateDescription = r.descriptionKey
          ? (
              await reports.query({
                where: { job: id, descriptionKey: r.descriptionKey },
                limit: 2,
              })
            ).items.length > 1
          : false;
        const incoming =
          r.url && !job.linkCoverageIncomplete
            ? await storage<Edge>(ctx, "edges").count({
                job: id,
                target: r.url,
              })
            : null;
        r.incoming = incoming;
        const count = job.counts;
        if (!r.titleKey) count.missingTitle++;
        if (!r.descriptionKey) count.missingDescription++;
        if (duplicateTitle) {
          count.duplicateTitle++;
          r.issues.push("Duplicate explicit SEO title in this audit.");
        }
        if (duplicateDescription) {
          count.duplicateDescription++;
          r.issues.push("Duplicate explicit SEO description in this audit.");
        }
        if (r.noIndex) count.noIndex++;
        if (r.analysis.linksAssessed && !r.analysis.internal.length)
          count.lowLinks++;
        if (incoming === null)
          r.issues.push(
            "Incoming links and orphan status not assessed: some content URLs or body links are unavailable in this audit. Run a new audit after resolving coverage gaps.",
          );
        if (r.url && incoming === 0 && !r.noIndex) {
          count.orphan++;
          r.issues.push(
            "Potentially orphaned: no incoming links from analyzed bodies. Navigation and external links are not included.",
          );
        }
        r.issues = [...new Set(r.issues)];
        const issueCount =
          r.issues.length +
          r.analysis.checks.filter(
            (c) => c.status === "problem" || c.status === "improve",
          ).length;
        count.issues += issueCount;
        if (issueCount) job.attention = (job.attention ?? 0) + 1;
        if (r.analysis.score !== null) {
          job.scoreTotal += r.analysis.score;
          job.scored++;
        }
        await reports.put(row.id, r);
        job.assessed++;
      }
      if (page.hasMore && page.cursor) job.cursor = page.cursor;
      else {
        job.phase = "complete";
        delete job.cursor;
      }
    }
    delete job.error;
    job.failures = 0;
    job.nextAttemptAt = 0;
    job.lastProgressAt = new Date().toISOString();
  } catch (e) {
    // Report writes may have succeeded. Replay them, but commit counters and
    // cursor only together after the entire step succeeds.
    job = structuredClone(baseline);
    job.error =
      e instanceof Error ? e.message.slice(0, 1000) : "Audit step failed";
    job.failures = (job.failures ?? 0) + 1;
    job.nextAttemptAt =
      Date.now() + Math.min(16, 2 ** (job.failures - 1)) * 60000;
    if (job.failures >= 5) {
      job.resumePhase = job.phase === "assess" ? "assess" : "scan";
      job.phase = "failed";
    }
  }
  job.lease = 0;
  const saved = await jobs.compareAndSet(id, lock.revision, job);
  // A cancellation or another lease owner may have superseded this worker.
  return saved.applied ? job : ((await jobs.get(id)) ?? baseline);
}
export function relatedCandidates(
  source: AuditRecord,
  candidates: AuditRecord[],
): { entry: AuditRecord; score: number }[] {
  const tokens = new Set(
    normalize([source.title, ...source.keywords].join(" "))
      .split(" ")
      .filter((t) => t.length > 2),
  );
  return candidates
    .filter(
      (c) =>
        c.url &&
        c.url !== source.url &&
        !c.noIndex &&
        c.locale === source.locale &&
        !source.analysis.internal.includes(c.url),
    )
    .map((entry) => {
      const other = new Set(
        normalize([entry.title, ...entry.keywords].join(" "))
          .split(" ")
          .filter((t) => t.length > 2),
      );
      const overlap = [...tokens].filter((t) => other.has(t)).length;
      return {
        entry,
        score: overlap
          ? overlap / new Set([...tokens, ...other]).size +
            (entry.cornerstone ? 0.1 : 0)
          : 0,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.url.localeCompare(b.entry.url))
    .slice(0, 5);
}

const taskName = (id: string) => `audit-${id}`;
const terminal = (job: AuditJob) =>
  ["complete", "cancelled", "failed"].includes(job.phase);
async function enableBackground(ctx: PluginContext, id: string): Promise<void> {
  let schedulingError: string | undefined;
  try {
    if (!ctx.cron) throw new Error("Host scheduling API is unavailable");
    // A persistent recurring task survives process crashes and does not rely on
    // re-arming a one-shot from inside the task being deleted by EmDash.
    await ctx.cron.schedule(taskName(id), {
      schedule: "*/15 * * * * *",
      data: { job: id },
    });
  } catch (error) {
    schedulingError =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Could not schedule background work";
  }
  const jobs = storage<AuditJob>(ctx, "jobs");
  const row = await jobs.getVersioned(id);
  if (!row) return;
  const next = { ...row.value, background: !schedulingError, schedulingError };
  await jobs.compareAndSet(id, row.revision, next);
}
export async function runAuditBatch(
  ctx: PluginContext,
  id: string,
): Promise<AuditJob> {
  const deadline = Date.now() + 5000;
  let job = await storage<AuditJob>(ctx, "jobs").get(id);
  if (!job) throw new Error("Audit not found");
  for (let n = 0; n < 25 && Date.now() < deadline; n++) {
    if (
      terminal(job) ||
      job.lease > Date.now() ||
      (job.nextAttemptAt ?? 0) > Date.now()
    )
      break;
    const before = `${job.phase}:${job.collectionIndex}:${job.cursor}:${job.processed}:${job.assessed}`;
    job = await stepAudit(ctx, id);
    if (
      `${job.phase}:${job.collectionIndex}:${job.cursor}:${job.processed}:${job.assessed}` ===
      before
    )
      break;
  }
  if (terminal(job)) await ctx.cron?.cancel(taskName(id));
  return job;
}
export async function auditCron(
  event: CronEvent,
  ctx: PluginContext,
): Promise<void> {
  const id = event.data?.job;
  if (
    typeof id !== "string" ||
    !/^[0-9a-f-]{36}$/u.test(id) ||
    event.name !== taskName(id)
  )
    return;
  const job = await storage<AuditJob>(ctx, "jobs").get(id);
  if (!job) {
    await ctx.cron?.cancel(event.name);
    return;
  }
  await runAuditBatch(ctx, id);
}
export async function cancelAudit(
  ctx: PluginContext,
  id: string,
): Promise<AuditJob> {
  const jobs = storage<AuditJob>(ctx, "jobs");
  for (let n = 0; n < 3; n++) {
    const row = await jobs.getVersioned(id);
    if (!row) throw new Error("Audit not found");
    if (terminal(row.value)) return row.value;
    const next = { ...row.value, phase: "cancelled" as const, lease: 0 };
    if ((await jobs.compareAndSet(id, row.revision, next)).applied) {
      await ctx.cron?.cancel(taskName(id));
      return next;
    }
  }
  throw new Error("Audit status changed; refresh before cancelling again");
}
export async function resumeAudit(
  ctx: PluginContext,
  id: string,
): Promise<AuditJob> {
  const jobs = storage<AuditJob>(ctx, "jobs"),
    row = await jobs.getVersioned(id);
  if (!row) throw new Error("Audit not found");
  if (row.value.phase === "cancelled" || row.value.phase === "complete")
    return row.value;
  if (row.value.lease > Date.now()) return row.value;
  const next = {
    ...row.value,
    phase: row.value.resumePhase ?? row.value.phase,
    failures: 0,
    nextAttemptAt: 0,
    error: undefined,
  };
  if (!(await jobs.compareAndSet(id, row.revision, next)).applied)
    return (await jobs.get(id)) ?? row.value;
  await enableBackground(ctx, id);
  return runAuditBatch(ctx, id);
}

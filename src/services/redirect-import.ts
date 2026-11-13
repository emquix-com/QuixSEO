import type { PluginContext, RedirectInfo } from "emdash/plugin";
import {
  parseRedirectCsv,
  type RedirectImportRow,
} from "../domain/redirect-import.js";
import { storage } from "./context.js";

interface RedirectImport {
  id: string;
  rows: RedirectImportRow[];
  preview: string[];
  results: ("Created" | "Already matches")[];
  approved: boolean;
  lease: number;
  error?: string;
}

const imports = (ctx: PluginContext) =>
  storage<RedirectImport>(ctx, "redirect_imports");
const groupName = "quixseo-import";
const batchSize = 3;

function matches(existing: RedirectInfo, row: RedirectImportRow) {
  return (
    existing.destination === row.destination &&
    existing.type === row.type &&
    existing.enabled === row.enabled &&
    existing.isPattern === row.pattern
  );
}

export async function prepareRedirectImport(
  ctx: PluginContext,
  actor: string,
  csv: unknown,
) {
  const rows = parseRedirectCsv(csv);
  const journal = imports(ctx);
  const current = await journal.getVersioned(actor);
  if (current?.value.lease && current.value.lease > Date.now()) {
    throw new Error("Wait for the current import batch to finish");
  }
  if (
    current?.value.approved &&
    current.value.results.length < current.value.rows.length
  ) {
    throw new Error(
      "Resume or close the current import before reviewing another CSV",
    );
  }
  if (!ctx.redirects?.create)
    throw new Error("Redirect write capability unavailable");
  const existing = new Map<string, RedirectInfo>();
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
    const page = await ctx.redirects.list({ limit: 100, cursor });
    for (const rule of page.items) existing.set(rule.source, rule);
    cursor = page.cursor;
    if (!cursor) break;
  }
  const plan: RedirectImport = {
    id: crypto.randomUUID(),
    rows,
    preview: rows.map((row) => {
      const rule = existing.get(row.source);
      return rule
        ? matches(rule, row)
          ? "Already matches"
          : "Conflict"
        : cursor
          ? "Check on apply"
          : "Create";
    }),
    results: [],
    approved: false,
    lease: 0,
  };
  if (
    !(await journal.compareAndSet(actor, current?.revision ?? null, plan))
      .applied
  ) {
    throw new Error(
      "The current import changed. Reload Redirects and try again",
    );
  }
  return plan;
}

export const currentRedirectImport = (ctx: PluginContext, actor: string) =>
  imports(ctx).get(actor);

export async function closeRedirectImport(
  ctx: PluginContext,
  actor: string,
  id: string,
) {
  const journal = imports(ctx);
  const stored = await journal.getVersioned(actor);
  if (
    !stored ||
    stored.value.id !== id ||
    stored.value.lease > Date.now() ||
    !(await journal.compareAndDelete(actor, stored.revision)).applied
  ) {
    throw new Error("The import changed or is running. Reload Redirects");
  }
}

export async function applyRedirectImport(
  ctx: PluginContext,
  actor: string,
  id: string,
) {
  const redirects = ctx.redirects;
  if (!redirects?.create)
    throw new Error("Redirect write capability unavailable");
  const journal = imports(ctx);
  const stored = await journal.getVersioned(actor);
  if (!stored || stored.value.id !== id)
    throw new Error("This import review is no longer current");
  const plan = stored.value;
  if (plan.lease > Date.now())
    throw new Error("This import is running. Reload Redirects shortly");
  if (plan.results.length === plan.rows.length) return plan;
  if (!plan.approved && plan.preview.includes("Conflict")) {
    throw new Error("Resolve the preview conflicts and review the CSV again");
  }
  plan.approved = true;
  plan.lease = Date.now() + 60000;
  delete plan.error;
  const lock = await journal.compareAndSet(actor, stored.revision, plan);
  if (!lock.applied || !lock.revision)
    throw new Error("This import changed. Reload Redirects");
  let revision = lock.revision;
  for (const row of plan.rows.slice(
    plan.results.length,
    plan.results.length + batchSize,
  )) {
    try {
      let cursor: string | undefined;
      let existing: RedirectInfo | undefined;
      for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
        const page = await redirects.list({
          search: row.source,
          limit: 100,
          cursor,
        });
        existing = page.items.find((rule) => rule.source === row.source);
        cursor = page.cursor;
        if (existing || !cursor) break;
      }
      if (existing && !matches(existing, row)) {
        throw new Error(
          "A different rule now uses this source. Review it in EmDash Redirects",
        );
      }
      if (!existing) {
        if (cursor)
          throw new Error(
            "Too many matching rules to verify this source safely",
          );
        if (Date.now() >= plan.lease) throw new Error("This batch timed out");
        await redirects.create({
          source: row.source,
          destination: row.destination,
          type: row.type,
          enabled: row.enabled,
          groupName,
        });
      }
      plan.results.push(existing ? "Already matches" : "Created");
    } catch (error) {
      plan.error = `CSV line ${row.line}: ${error instanceof Error ? error.message.slice(0, 350) : "Unable to verify or create the rule"}`;
      break;
    }
    const saved = await journal.compareAndSet(actor, revision, plan);
    if (!saved.applied || !saved.revision)
      throw new Error("Import progress changed. Reload Redirects");
    revision = saved.revision;
  }
  plan.lease = 0;
  if (!(await journal.compareAndSet(actor, revision, plan)).applied) {
    throw new Error("Import progress changed. Reload Redirects");
  }
  return plan;
}

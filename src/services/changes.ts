import type { PluginContext } from "emdash/plugin";
import { validateSchema } from "../domain/schema.js";
import type { EntryConfig, Seo } from "../domain/validation.js";
import {
  emptySeo,
  entryConfigSchema,
  fingerprint,
  seoSchema,
  stableJson,
} from "../domain/validation.js";
import { entryKey, getEntry, storage, titleOf } from "./context.js";
export interface Proposal {
  collection: string;
  id: string;
  seo: Partial<Seo>;
  config: Partial<EntryConfig>;
  warnings?: string[];
}
export interface ChangeRow extends Proposal {
  /** Display name for nontechnical change review; older journals may omit it. */
  entryTitle?: string;
  beforeSeo: Seo;
  afterSeo: Seo;
  beforeConfig: EntryConfig;
  afterConfig: EntryConfig;
  configRevision: string | null;
  status:
    | "pending"
    | "applying"
    | "reverting"
    | "applied"
    | "conflict"
    | "rolled-back";
  error?: string;
}
export interface ChangePlan {
  id: string;
  actor: string;
  createdAt: string;
  kind: string;
  rows: ChangeRow[];
  queued: Proposal[];
  confirmed: boolean;
  lease: number;
}
function checkedConfig(
  before: EntryConfig,
  patch: Partial<EntryConfig>,
): EntryConfig {
  const result = entryConfigSchema.parse({ ...before, ...patch });
  const issues = result.schema ? validateSchema(result.schema) : [];
  if (issues.length) throw new Error(issues.join(" "));
  return result;
}
function boundPlan(plan: ChangePlan): void {
  if (new TextEncoder().encode(JSON.stringify(plan)).length > 96000)
    throw new Error(
      "Preview exceeds 96 KB. Prepare a smaller batch to keep review and storage bounded.",
    );
}
export async function previewChanges(
  ctx: PluginContext,
  actorId: string,
  proposals: Proposal[],
  kind: string,
  expectedConfigFingerprint?: string,
): Promise<ChangePlan> {
  if (!proposals.length || proposals.length > 20)
    throw new Error("Preview between 1 and 20 entries at a time");
  if (
    new Set(proposals.map((p) => entryKey(p.collection, p.id))).size !==
    proposals.length
  )
    throw new Error("Select each entry only once");
  const rows: ChangeRow[] = [];
  for (const p of proposals.slice(0, 1)) {
    const item = await getEntry(ctx, p.collection, p.id);
    if (!item.seo)
      throw new Error(
        "Enable SEO on this collection in EmDash Content Types first",
      );
    const current = await storage<EntryConfig>(ctx, "entries").getVersioned(
      entryKey(p.collection, p.id),
    );
    const beforeSeo = seoSchema.parse(item.seo ?? emptySeo),
      beforeConfig = entryConfigSchema.parse(current?.value ?? {});
    if (
      expectedConfigFingerprint !== undefined &&
      (await fingerprint(beforeConfig)) !== expectedConfigFingerprint
    )
      throw new Error(
        "QuixSEO settings changed since this form opened. Copy your edits, refresh and retry; nothing was overwritten.",
      );
    rows.push({
      ...p,
      entryTitle: titleOf(item),
      beforeSeo,
      afterSeo: seoSchema.parse({ ...beforeSeo, ...p.seo }),
      beforeConfig,
      afterConfig: checkedConfig(beforeConfig, p.config),
      configRevision: current?.revision ?? null,
      status: "pending",
    });
  }
  const plan: ChangePlan = {
    id: crypto.randomUUID(),
    actor: actorId,
    createdAt: new Date().toISOString(),
    kind,
    rows,
    queued: proposals.slice(1),
    confirmed: false,
    lease: 0,
  };
  boundPlan(plan);
  await storage<ChangePlan>(ctx, "changes").put(plan.id, plan);
  return plan;
}
export async function prepareNext(
  ctx: PluginContext,
  actorId: string,
  id: string,
): Promise<ChangePlan> {
  const journal = storage<ChangePlan>(ctx, "changes"),
    current = await journal.getVersioned(id);
  if (!current) throw new Error("Preview not found");
  const plan = current.value;
  if (plan.actor !== actorId || plan.confirmed)
    throw new Error("Preview cannot be changed");
  const p = plan.queued[0];
  if (!p) return plan;
  const item = await getEntry(ctx, p.collection, p.id);
  if (!item.seo) throw new Error("Enable core SEO for the selected collection");
  const cfg = await storage<EntryConfig>(ctx, "entries").getVersioned(
    entryKey(p.collection, p.id),
  );
  const beforeSeo = seoSchema.parse(item.seo),
    beforeConfig = entryConfigSchema.parse(cfg?.value ?? {});
  plan.rows.push({
    ...p,
    entryTitle: titleOf(item),
    beforeSeo,
    afterSeo: seoSchema.parse({ ...beforeSeo, ...p.seo }),
    beforeConfig,
    afterConfig: checkedConfig(beforeConfig, p.config),
    configRevision: cfg?.revision ?? null,
    status: "pending",
  });
  plan.queued.shift();
  boundPlan(plan);
  if (!(await journal.compareAndSet(id, current.revision, plan)).applied)
    throw new Error("Preview changed; reload it");
  return plan;
}
export async function applyChange(
  ctx: PluginContext,
  actorId: string,
  planId: string,
  rollback = false,
): Promise<ChangePlan> {
  const journal = storage<ChangePlan>(ctx, "changes");
  const stored = await journal.getVersioned(planId);
  if (!stored) throw new Error("Preview not found");
  const plan = stored.value;
  if (plan.queued.length)
    throw new Error(
      "Finish preparing and reviewing all entries before confirming",
    );
  if (plan.actor !== actorId)
    throw new Error(
      "Only the person who previewed this operation may confirm or revert it",
    );
  if (plan.lease > Date.now())
    throw new Error("This operation is already running. Refresh shortly.");
  const row = plan.rows.find((r) =>
    rollback
      ? r.status === "applied" || r.status === "reverting"
      : r.status === "pending" || r.status === "applying",
  );
  if (!row) return plan;
  if (
    plan.rows.some((r) => stableJson(r.beforeSeo) !== stableJson(r.afterSeo))
  ) {
    throw new Error(
      "The tested EmDash 1.3.1 and 1.4.0 sandbox runners cannot write native SEO fields. This preview has not been applied. Copy the reviewed native values into EmDash’s SEO panel, then prepare a QuixSEO-only operation. See docs/compatibility.md.",
    );
  }
  const retry = row.status === "applying" || row.status === "reverting";
  plan.lease = Date.now() + 60000;
  plan.confirmed = true;
  row.status = rollback ? "reverting" : "applying";
  const lock = await journal.compareAndSet(planId, stored.revision, plan);
  if (!lock.applied) throw new Error("Operation changed; reload the preview");
  try {
    const item = await getEntry(ctx, row.collection, row.id);
    const current = await storage<EntryConfig>(ctx, "entries").getVersioned(
      entryKey(row.collection, row.id),
    );
    const fromSeo = rollback ? row.afterSeo : row.beforeSeo,
      toSeo = rollback ? row.beforeSeo : row.afterSeo;
    const fromConfig = rollback ? row.afterConfig : row.beforeConfig,
      toConfig = rollback ? row.beforeConfig : row.afterConfig;
    const same = async (a: unknown, b: unknown) =>
      (await fingerprint(a)) === (await fingerprint(b));
    const nativeAtTarget = await same(item.seo, toSeo),
      configAtTarget = await same(
        entryConfigSchema.parse(current?.value ?? {}),
        toConfig,
      );
    if (!(await same(item.seo, fromSeo)) && !(retry && nativeAtTarget))
      throw new Error(
        "Native SEO changed after preview; no overwrite performed",
      );
    if (
      !(await same(
        entryConfigSchema.parse(current?.value ?? {}),
        fromConfig,
      )) &&
      !(retry && configAtTarget)
    )
      throw new Error(
        "QuixSEO settings changed after preview; no overwrite performed",
      );
    if (
      !rollback &&
      !retry &&
      (current?.revision ?? null) !== row.configRevision
    )
      throw new Error("QuixSEO revision changed after preview");
    if (!configAtTarget) {
      const saved = await storage<EntryConfig>(ctx, "entries").compareAndSet(
        entryKey(row.collection, row.id),
        current?.revision ?? null,
        toConfig,
      );
      if (!saved.applied)
        throw new Error("QuixSEO settings changed concurrently");
    }
    row.status = rollback ? "rolled-back" : "applied";
    delete row.error;
  } catch (e) {
    // Retain applying on transport failure so target-state reconciliation can resume.
    row.error = e instanceof Error ? e.message : "Operation failed";
    if (/changed|overwrite|revision|concurrent/iu.test(row.error))
      row.status = "conflict";
  }
  plan.lease = 0;
  const saved = await journal.compareAndSet(plan.id, lock.revision, plan);
  if (!saved.applied)
    throw new Error("Journal changed; reload to reconcile the operation");
  return plan;
}

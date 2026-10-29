import type { PluginContext } from "emdash/plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuditJob,
  auditCron,
  cancelAudit,
  resumeAudit,
  runAuditBatch,
  startAudit,
  stepAudit,
} from "../../src/services/audit.js";
import {
  auditBlocks,
  reportsView,
  suggestionsView,
} from "../../src/ui/audits.js";

// Durable storage double: every read is detached, and revisions enforce CAS.
function bucket() {
  const rows = new Map<
    string,
    { value: Record<string, unknown>; revision: string }
  >();
  let revision = 0;
  const read = (id: string) => structuredClone(rows.get(id) ?? null);
  const put = async (id: string, value: unknown) => {
    rows.set(id, {
      value: structuredClone(value) as Record<string, unknown>,
      revision: String(++revision),
    });
  };
  return {
    get: async (id: string) => read(id)?.value ?? null,
    getVersioned: async (id: string) => read(id),
    put,
    putMany: async (items: { id: string; data: unknown }[]) => {
      for (const i of items) await put(i.id, i.data);
    },
    compareAndSet: async (
      id: string,
      expected: string | null,
      value: unknown,
    ) => {
      if ((rows.get(id)?.revision ?? null) !== expected)
        return { applied: false, revision: rows.get(id)?.revision ?? null };
      await put(id, value);
      return { applied: true, revision: String(revision) };
    },
    count: async (where: Record<string, unknown>) =>
      [...rows.values()].filter((r) =>
        Object.entries(where).every(([k, v]) => r.value[k] === v),
      ).length,
    query: async ({
      where = {},
      limit = 10,
      cursor,
    }: {
      where?: Record<string, unknown>;
      limit?: number;
      cursor?: string;
    } = {}) => {
      const all = [...rows.entries()].filter(([, r]) =>
        Object.entries(where).every(([k, v]) => r.value[k] === v),
      );
      const offset = Number(cursor ?? 0),
        next = offset + limit;
      return {
        items: all
          .slice(offset, next)
          .map(([id, r]) => ({ id, data: structuredClone(r.value) })),
        hasMore: next < all.length,
        cursor: next < all.length ? String(next) : undefined,
      };
    },
  };
}
function fixture(count: number) {
  const storage = {
    jobs: bucket(),
    reports: bucket(),
    edges: bucket(),
    entries: bucket(),
    settings: bucket(),
  };
  const tasks = new Map<string, unknown>();
  const list = vi.fn(
    async (collection: string, { cursor }: { cursor?: string }) => {
      const offset = Number(cursor ?? 0);
      const size = collection === "posts" ? count : 1;
      return {
        items:
          offset >= size
            ? []
            : [
                {
                  id: String(offset),
                  slug: `article-${offset}`,
                  status: "published",
                  locale: "en",
                  data: {
                    title: `Gardening ${offset}`,
                    body: "Care for plants. Check their soil.",
                    excerpt: "Gardening advice",
                  },
                  seo: {
                    title: `Gardening ${offset}`,
                    description: `Advice ${offset}`,
                  },
                },
              ],
        hasMore: offset + 1 < size,
        cursor: offset + 1 < size ? String(offset + 1) : undefined,
      };
    },
  );
  const ctx = {
    site: { url: "https://example.com", locale: "en" },
    storage,
    schema: {
      listCollections: async () =>
        ["posts", "pages"].map((slug) => ({
          slug,
          hasSeo: true,
          routable: true,
          fields: [{ slug: "body", type: "portableText" }],
        })),
    },
    content: {
      list,
      getPublicUrl: async (c: string, id: string) =>
        `https://example.com/${c}/${id}`,
    },
    cron: {
      schedule: vi.fn(async (name: string, data: unknown) => {
        tasks.set(name, data);
      }),
      cancel: vi.fn(async (name: string) => {
        tasks.delete(name);
      }),
    },
  } as unknown as PluginContext;
  const get = async (id: string) =>
    (await storage.jobs.get(id)) as unknown as AuditJob;
  const tick = async (id: string) =>
    auditCron(
      {
        name: `audit-${id}`,
        data: { job: id },
        scheduledAt: new Date().toISOString(),
      },
      ctx,
    );
  return { ctx, storage, tasks, list, get, tick };
}
afterEach(() => vi.useRealTimers());
describe("durable automatic audits", () => {
  it.each([
    0, 1, 10, 120,
  ])("finishes %i posts plus another collection through bounded scheduled batches", async (n) => {
    const f = fixture(n);
    let job = await startAudit(f.ctx, "admin");
    if (n === 120) {
      expect(job.phase).toBe("scan");
      expect(job.processed).toBeLessThanOrEqual(25);
    }
    for (let i = 0; i < 20 && job.phase !== "complete"; i++) {
      await f.tick(job.id);
      job = await f.get(job.id);
    }
    expect(job).toMatchObject({
      phase: "complete",
      processed: n + 1,
      assessed: n + 1,
      scored: n + 1,
    });
    expect(await f.storage.reports.count({ job: job.id })).toBe(n + 1);
    expect(f.tasks.size).toBe(0);
    const final = structuredClone(job);
    await f.tick(job.id);
    expect(await f.get(job.id)).toEqual(final);
  });
  it("preserves counters across a crash after snapshot persistence and retries with backoff", async () => {
    vi.useFakeTimers();
    const f = fixture(40);
    const job = await startAudit(f.ctx, "admin");
    const put = f.storage.reports.compareAndSet;
    f.storage.reports.compareAndSet = vi.fn(
      async (...args: Parameters<typeof put>) => {
        await put(...args);
        throw new Error("Process interrupted after write");
      },
    );
    const failed = await stepAudit(f.ctx, job.id);
    expect(failed.processed).toBe(job.processed);
    expect(failed.failures).toBe(1);
    const reads = f.list.mock.calls.length;
    await runAuditBatch(f.ctx, job.id);
    expect(f.list).toHaveBeenCalledTimes(reads);
    f.storage.reports.compareAndSet = put;
    vi.advanceTimersByTime(60001);
    let resumed = await runAuditBatch(f.ctx, job.id);
    for (let i = 0; i < 10 && resumed.phase !== "complete"; i++)
      resumed = await runAuditBatch(f.ctx, job.id);
    expect(resumed).toMatchObject({
      phase: "complete",
      processed: 41,
      assessed: 41,
      scored: 41,
    });
    expect(await f.storage.reports.count({ job: job.id })).toBe(41);
  });
  it("replays assessment writes without duplicating findings or aggregate totals", async () => {
    vi.useFakeTimers();
    const f = fixture(40);
    let job = await startAudit(f.ctx, "admin");
    while (job.phase === "scan") job = await stepAudit(f.ctx, job.id);
    const put = f.storage.reports.put;
    f.storage.reports.put = async (...args: Parameters<typeof put>) => {
      await put(...args);
      throw new Error("Interrupted assessment write");
    };
    expect((await stepAudit(f.ctx, job.id)).assessed).toBe(0);
    f.storage.reports.put = put;
    vi.advanceTimersByTime(60001);
    for (let i = 0; i < 10 && job.phase !== "complete"; i++)
      job = await runAuditBatch(f.ctx, job.id);
    expect(job).toMatchObject({
      phase: "complete",
      processed: 41,
      assessed: 41,
      scored: 41,
    });
    const records = await f.storage.reports.query({ limit: 100 });
    for (const { data } of records.items)
      expect(new Set(data.issues as string[]).size).toBe(
        (data.issues as string[]).length,
      );
  });
  it("does not keep scheduling audits from an older scoring model", async () => {
    const f = fixture(40),
      job = await startAudit(f.ctx, "admin");
    await f.storage.jobs.put(job.id, { ...job, modelVersion: undefined });
    expect((await resumeAudit(f.ctx, job.id)).phase).toBe("failed");
    expect(f.tasks.size).toBe(0);
  });
  it("paginates suggestions beyond the first 100 candidates without claiming global ranking", async () => {
    const f = fixture(120);
    let job = await startAudit(f.ctx, "admin");
    for (let i = 0; i < 20 && job.phase !== "complete"; i++)
      job = await runAuditBatch(f.ctx, job.id);
    const id = (await f.storage.reports.query()).items[0]?.id;
    if (!id) throw new Error("Missing report");
    const first = JSON.stringify(await suggestionsView(f.ctx, id));
    expect(first).toContain("Search next 100 candidates");
    const later = JSON.stringify(await suggestionsView(f.ctx, id, "100"));
    expect(later).not.toContain("Search next 100 candidates");
    expect(later).toContain("Gardening 100");
    expect(later).toContain("not globally ranked");
  });
  it("fails after five spaced attempts and permits an explicit recovery", async () => {
    vi.useFakeTimers();
    const f = fixture(40),
      job = await startAudit(f.ctx, "admin");
    const implementation = f.list.getMockImplementation();
    if (!implementation) throw new Error("Missing fixture implementation");
    f.list.mockRejectedValue(new Error("Temporary content outage"));
    for (let i = 0; i < 5; i++) {
      await f.tick(job.id);
      vi.advanceTimersByTime(17 * 60000);
    }
    expect(await f.get(job.id)).toMatchObject({
      phase: "failed",
      failures: 5,
      processed: job.processed,
    });
    expect(f.tasks.size).toBe(0);
    f.list.mockImplementation(implementation);
    await resumeAudit(f.ctx, job.id);
    for (let i = 0; i < 10 && (await f.get(job.id)).phase !== "complete"; i++)
      await f.tick(job.id);
    expect(await f.get(job.id)).toMatchObject({
      phase: "complete",
      processed: 41,
      assessed: 41,
    });
  });
  it("does not let concurrent workers or a superseded lease overwrite cancellation", async () => {
    const f = fixture(60),
      job = await startAudit(f.ctx, "admin");
    const list = f.list.getMockImplementation();
    if (!list) throw new Error("Missing fixture implementation");
    let unblock: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    f.list.mockImplementation(async (...args) => {
      await gate;
      return list(...args);
    });
    const running = stepAudit(f.ctx, job.id);
    await vi.waitFor(async () =>
      expect((await f.get(job.id)).lease).toBeGreaterThan(Date.now()),
    );
    expect((await stepAudit(f.ctx, job.id)).processed).toBe(job.processed);
    await cancelAudit(f.ctx, job.id);
    unblock();
    expect((await running).phase).toBe("cancelled");
    await f.tick(job.id);
    expect(await f.get(job.id)).toMatchObject({
      phase: "cancelled",
      processed: job.processed,
    });
    expect(f.tasks.size).toBe(0);
  });
  it("recovers an expired process lease and exposes a safe fallback without scheduling", async () => {
    vi.useFakeTimers();
    const f = fixture(40);
    f.ctx.cron = undefined;
    let job = await startAudit(f.ctx, "admin");
    expect(job.background).toBe(false);
    expect(JSON.stringify(auditBlocks(job))).toContain("Resume audit");
    await f.storage.jobs.put(job.id, { ...job, lease: Date.now() + 60000 });
    expect((await runAuditBatch(f.ctx, job.id)).processed).toBe(job.processed);
    vi.advanceTimersByTime(60001);
    for (let i = 0; i < 10 && job.phase !== "complete"; i++)
      job = await resumeAudit(f.ctx, job.id);
    expect(job).toMatchObject({
      phase: "complete",
      processed: 41,
      assessed: 41,
    });
  });
  it("shows bounded findings, source scope and contextual navigation", async () => {
    const f = fixture(0),
      job = await startAudit(f.ctx, "admin");
    const text = JSON.stringify(await reportsView(f.ctx, job.id));
    expect(text).toContain("SEO audit results");
    expect(text).toContain("Back to audit");
    expect(text).toContain("Internal link suggestions");
    expect(text).toContain("Finding");
    const recordId =
      (await f.storage.reports.query()).items[0]?.id ?? "missing";
    const suggestions = JSON.stringify(await suggestionsView(f.ctx, recordId));
    expect(suggestions).toContain("one eligible published article");
    expect(suggestions).toContain("Back to audit results");
    expect(suggestions).toContain("not globally ranked");
  });
});

it("distinguishes completed coverage from running, cancelled and failed audits", async () => {
  const f = fixture(0);
  const job = await startAudit(f.ctx, "admin");
  for (const [phase, expected] of [
    ["complete", "Audit completed. Results reflect"],
    ["scan", "Results are preliminary until the audit finishes."],
    ["cancelled", "Audit cancelled."],
    ["failed", "Audit interrupted."],
  ] as const) {
    const text = JSON.stringify(
      auditBlocks({ ...job, phase, incompleteAnalyses: 1 }),
    );
    expect(text).toContain(expected);
    expect(text).toContain("1 entries have partial analysis");
    expect(text).not.toContain("Findings are provisional");
  }
  const single = JSON.stringify(await reportsView(f.ctx, job.id));
  expect(single).not.toContain("Apply page options");
  expect(single).not.toContain('"page_action_id":"findings-page"');
  const multi = fixture(2);
  const multiJob = await startAudit(multi.ctx, "admin");
  expect(JSON.stringify(await reportsView(multi.ctx, multiJob.id))).toContain(
    "Apply page options",
  );
});

it("distinguishes already linked topical candidates from no overlap", async () => {
  const f = fixture(2);
  await startAudit(f.ctx, "admin");
  const records = (await f.storage.reports.query()).items;
  const source = records[0];
  const other = records[1];
  if (!source || !other) throw new Error("Missing records");
  const data =
    source.data as unknown as import("../../src/services/audit.js").AuditRecord;
  const target =
    other.data as unknown as import("../../src/services/audit.js").AuditRecord;
  await f.storage.reports.put(other.id, {
    ...target,
    title: data.title,
    keywords: data.keywords,
  });
  const linked = records.slice(1).map((r) => String(r.data.url));
  await f.storage.reports.put(source.id, {
    ...data,
    analysis: { ...data.analysis, internal: linked },
  });
  expect(JSON.stringify(await suggestionsView(f.ctx, source.id))).toContain(
    "already linked",
  );
  await f.storage.reports.put(source.id, {
    ...data,
    title: "zzunique",
    keywords: [],
  });
  expect(JSON.stringify(await suggestionsView(f.ctx, source.id))).toContain(
    "No sufficiently relevant",
  );
});

import type { PluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import { createPluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import { afterEach, describe, expect, it } from "vitest";
import { entryConfigSchema } from "../../src/domain/validation.js";
import type { AuditJob, AuditRecord } from "../../src/services/audit.js";
import type { ChangePlan } from "../../src/services/changes.js";

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => {
  await host?.dispose();
  host = undefined;
});
async function setup(url = "https://example.com") {
  host = await createPluginRuntimeTestHost({
    site: { name: "Test Garden", url, locale: "en" },
  });
  await host.fixtures.collection({
    slug: "posts",
    label: "Posts",
    supports: ["seo", "drafts", "revisions"],
    urlPattern: "/posts/{slug}",
    fields: [
      { slug: "title", label: "Title", type: "string", translatable: true },
      { slug: "excerpt", label: "Excerpt", type: "text", translatable: true },
      { slug: "body", label: "Body", type: "portableText", translatable: true },
    ],
  });
  const admin = await host.fixtures.user({
    email: "admin@example.test",
    role: "admin",
  });
  const item = await host.fixtures.content("posts", {
    data: {
      title: "Garden care",
      excerpt: "Learn to care for a garden.",
      body: [
        {
          _type: "block",
          _key: "body",
          style: "normal",
          children: [
            {
              _type: "span",
              _key: "span",
              text: "Garden care is simple. Water the plants.",
              marks: [],
            },
          ],
          markDefs: [],
        },
      ],
    },
    slug: "garden-care",
    status: "published",
    authorId: admin.id,
  });
  return { host, admin, item };
}
function noError(result: unknown) {
  expect(JSON.stringify(result)).not.toContain("could not complete");
}
describe("Official Worker Loader sandbox and production runtime", () => {
  it("loads every declared Block Kit page and editor with real content", async () => {
    const { host, admin, item } = await setup();
    for (const path of [
      "/dashboard",
      "/settings",
      "/bulk",
      "/migration",
      "/redirects",
      "/history",
    ]) {
      const result = await host.admin.loadPage(path, { user: admin });
      noError(result);
      expect(result.blocks.length).toBeGreaterThan(1);
    }
    const panel = await host.admin.loadEditorPanel(
      "quixseo",
      "posts",
      item.id,
      { user: admin },
    );
    noError(panel);
    expect(JSON.stringify(panel)).toContain("Garden care");
  });
  it("enforces authentication, role permissions and ownership", async () => {
    const { host, admin, item } = await setup();
    const anon = await host.actions.routes.request("admin", {
      body: { type: "page_load", page: "/dashboard" },
    });
    expect(anon.status).toBe(401);
    const subscriber = await host.fixtures.user({
      email: "reader@example.test",
      role: "subscriber",
    });
    const denied = await host.actions.routes.request("admin", {
      user: subscriber,
      headers: { "X-EmDash-Request": "1" },
      body: { type: "page_load", page: "/dashboard" },
    });
    expect(denied.status).toBe(403);
    const author = await host.fixtures.user({
      email: "author@example.test",
      role: "author",
    });
    await expect(
      host.admin.loadEditorPanel("quixseo", "posts", item.id, { user: author }),
    ).rejects.toThrow();
    const forged = await host.actions.routes.request("editor", {
      user: admin,
      headers: { "X-EmDash-Request": "1" },
      body: {
        type: "panel_load",
        ui: {
          surface: "content-editor-panel",
          entry: { collection: "posts", id: item.id },
        },
      },
    });
    expect(await forged.text()).toContain(
      "Open QuixSEO from a saved content entry",
    );
  });
  it("previews, applies, resumes, and rolls back QuixSEO-managed data", async () => {
    const { host, admin, item } = await setup();
    const second = await host.fixtures.content("posts", {
      data: { title: "Second" },
      slug: "second",
    });
    const result = await host.admin.submit(
      "/bulk",
      "bulk-preview",
      {
        changes: JSON.stringify([
          {
            collection: "posts",
            id: item.id,
            seo: {},
            config: { keyphrases: ["garden"] },
          },
          {
            collection: "posts",
            id: second.id,
            config: { cornerstone: true },
          },
        ]),
      },
      { user: admin },
    );
    noError(result);
    const plans = await host.inspect.storage.list<ChangePlan>("changes");
    const id = plans[0]?.id;
    expect(id).toBeTruthy();
    noError(
      await host.admin.act("/bulk", "prepare-next", { value: id, user: admin }),
    );
    noError(
      await host.admin.act("/bulk", "confirm", { value: id, user: admin }),
    );
    await host.restart();
    noError(
      await host.admin.act("/bulk", "confirm", { value: id, user: admin }),
    );
    noError(
      await host.admin.act("/bulk", "confirm", { value: id, user: admin }),
    );
    expect(
      (
        await host.inspect.storage.get<ChangePlan>("changes", id ?? "")
      )?.rows.map((r) => r.status),
    ).toEqual(["applied", "applied"]);
    noError(
      await host.admin.act("/history", "rollback", { value: id, user: admin }),
    );
    noError(
      await host.admin.act("/history", "rollback", { value: id, user: admin }),
    );
    expect(
      (
        await host.inspect.storage.get<ChangePlan>("changes", id ?? "")
      )?.rows.map((r) => r.status),
    ).toEqual(["rolled-back", "rolled-back"]);
  });
  it("detects QuixSEO conflicts and refuses stale rollback", async () => {
    const { host, admin, item } = await setup();
    const make = async (title: string) => {
      await host.admin.submit(
        "/bulk",
        "bulk-preview",
        {
          changes: JSON.stringify([
            { collection: "posts", id: item.id, config: { ogTitle: title } },
          ]),
        },
        { user: admin },
      );
      return (await host.inspect.storage.list<ChangePlan>("changes")).find(
        (p) => p.data.rows[0]?.afterConfig.ogTitle === title,
      )?.id;
    };
    const first = await make("First"),
      second = await make("Second");
    await host.admin.act("/bulk", "confirm", { value: first, user: admin });
    await host.admin.act("/bulk", "confirm", { value: second, user: admin });
    expect(
      (await host.inspect.storage.get<ChangePlan>("changes", second ?? ""))
        ?.rows[0]?.status,
    ).toBe("conflict");
    const third = await make("Third");
    await host.admin.act("/bulk", "confirm", { value: third, user: admin });
    await host.admin.act("/history", "rollback", { value: first, user: admin });
    expect(
      (await host.inspect.storage.get<ChangePlan>("changes", first ?? ""))
        ?.rows[0]?.status,
    ).toBe("conflict");
  });
  it("audits published entries incrementally and resumes after restart", async () => {
    const { host, admin } = await setup();
    await host.fixtures.content("posts", {
      data: { title: "Private draft secret" },
      slug: "private",
      status: "draft",
    });
    await host.fixtures.content("posts", {
      data: {
        title: "Link source",
        body: [
          {
            _type: "block",
            _key: "linked",
            style: "normal",
            children: [
              {
                _type: "span",
                _key: "s",
                text: "Garden care",
                marks: ["target"],
              },
            ],
            markDefs: [
              {
                _type: "link",
                _key: "target",
                href: "/posts/garden-care#tips",
              },
            ],
          },
        ],
      },
      slug: "link-source",
      status: "published",
    });
    noError(await host.admin.act("/dashboard", "audit-start", { user: admin }));
    const initial = (await host.inspect.storage.list<AuditJob>("jobs"))[0];
    expect(initial).toBeTruthy();
    if (!initial) throw new Error("No job");
    await host.restart();
    for (let n = 0; n < 5; n++) {
      noError(
        await host.admin.act("/dashboard", "audit-next", {
          user: admin,
          value: initial.id,
        }),
      );
      if (
        (await host.inspect.storage.get<AuditJob>("jobs", initial.id))
          ?.phase === "complete"
      )
        break;
    }
    const job = await host.inspect.storage.get<AuditJob>("jobs", initial.id);
    expect(job).toMatchObject({ phase: "complete", processed: 2, assessed: 2 });
    const reports = await host.inspect.storage.list<AuditRecord>("reports");
    expect(reports).toHaveLength(2);
    expect(
      reports.find((r) => r.data.title === "Garden care")?.data.incoming,
    ).toBe(1);
    expect(JSON.stringify(reports)).not.toContain("Private draft secret");
  });
  it("imports mapped Yoast keyphrases with reversible plugin-scoped writes", async () => {
    const { host, admin, item } = await setup();
    noError(
      await host.admin.submit(
        "/migration",
        "migration-preview",
        {
          json: JSON.stringify([
            {
              source: "yoast",
              collection: "posts",
              id: item.id,
              meta: {
                _yoast_wpseo_focuskw: "garden care",
              },
            },
          ]),
        },
        { user: admin },
      ),
    );
    const p = (await host.inspect.storage.list<ChangePlan>("changes"))[0];
    if (!p) throw new Error("No preview");
    noError(
      await host.admin.act("/migration", "confirm", {
        value: p.id,
        user: admin,
      }),
    );
    expect(
      (await host.inspect.storage.get<ChangePlan>("changes", p.id))?.rows[0]
        ?.status,
    ).toBe("applied");
    noError(
      await host.admin.act("/history", "rollback", {
        value: p.id,
        user: admin,
      }),
    );
    expect(
      (await host.inspect.storage.get<ChangePlan>("changes", p.id))?.rows[0]
        ?.status,
    ).toBe("rolled-back");
  });
  it("metadata hook contributes one primary graph and respects opt-out", async () => {
    const { host } = await setup();
    const event = {
      page: {
        kind: "custom",
        pageType: "website",
        url: "https://example.com/",
        path: "/",
        canonical: "https://example.com/",
        title: "Real site",
        pageTitle: "Real site",
        description: "Summary",
        image: null,
        locale: "en",
      },
    };
    const contributions = await host.transport.invokeHook(
      "page:metadata",
      event,
    );
    expect(JSON.stringify(contributions)).toContain('"id":"primary"');
    expect(JSON.stringify(contributions)).not.toContain("##webpage");
    expect(JSON.stringify(contributions)).toContain(
      '"url":"https://example.com/"',
    );
    expect(JSON.stringify(contributions)).not.toContain('"rel":"canonical"');
    await host.fixtures.plugin.storage("settings", "site", { metadata: false });
    expect(await host.transport.invokeHook("page:metadata", event)).toEqual([]);
  });
});

it("blocks unsupported native writes before changing any plugin data", async () => {
  const { host, admin, item } = await setup();
  noError(
    await host.admin.submit(
      "/bulk",
      "bulk-preview",
      {
        changes: JSON.stringify([
          {
            collection: "posts",
            id: item.id,
            seo: { title: "Blocked" },
            config: { cornerstone: true },
          },
        ]),
      },
      { user: admin },
    ),
  );
  const plan = (await host.inspect.storage.list<ChangePlan>("changes"))[0];
  if (!plan) throw new Error("Missing plan");
  const result = await host.admin.act("/bulk", "confirm", {
    user: admin,
    value: plan.id,
  });
  expect(JSON.stringify(result)).toContain(
    "sandbox runners cannot write native SEO",
  );
  expect(
    await host.inspect.storage.get("entries", `posts:${item.id}`),
  ).toBeNull();
  expect(
    (await host.inspect.storage.get<ChangePlan>("changes", plan.id))?.rows[0]
      ?.status,
  ).toBe("pending");
});

it("preserves omitted bulk settings through preview, apply, and rollback for every prepared row", async () => {
  const { host, admin, item } = await setup();
  const second = await host.fixtures.content("posts", {
    data: { title: "Second" },
    slug: "second",
  });
  const original = entryConfigSchema.parse({
    keyphrases: ["checkout"],
    noFollow: true,
    noSnippet: true,
    ogTitle: "Social title",
    ogDescription: "Social description",
    twitterTitle: "Twitter title",
    schema: { type: "BlogPosting", author: "Alex" },
  });
  for (const entry of [item, second])
    await host.fixtures.plugin.storage(
      "entries",
      `posts:${entry.id}`,
      original,
    );
  noError(
    await host.admin.submit(
      "/bulk",
      "bulk-preview",
      {
        changes: JSON.stringify(
          [item, second].map((entry) => ({
            collection: "posts",
            id: entry.id,
            config: { cornerstone: true },
          })),
        ),
      },
      { user: admin },
    ),
  );
  const plan = (await host.inspect.storage.list<ChangePlan>("changes"))[0];
  if (!plan) throw new Error("Missing plan");
  noError(
    await host.admin.act("/bulk", "prepare-next", {
      value: plan.id,
      user: admin,
    }),
  );
  const prepared = await host.inspect.storage.get<ChangePlan>(
    "changes",
    plan.id,
  );
  expect(prepared?.rows.map((r) => r.afterConfig)).toEqual([
    { ...original, cornerstone: true },
    { ...original, cornerstone: true },
  ]);
  for (const entry of [item, second])
    expect(
      await host.inspect.storage.get("entries", `posts:${entry.id}`),
    ).toEqual(original);
  for (let n = 0; n < 2; n++)
    noError(
      await host.admin.act("/bulk", "confirm", { value: plan.id, user: admin }),
    );
  for (const entry of [item, second])
    expect(
      await host.inspect.storage.get("entries", `posts:${entry.id}`),
    ).toEqual({ ...original, cornerstone: true });
  for (let n = 0; n < 2; n++)
    noError(
      await host.admin.act("/history", "rollback", {
        value: plan.id,
        user: admin,
      }),
    );
  for (const entry of [item, second])
    expect(
      await host.inspect.storage.get("entries", `posts:${entry.id}`),
    ).toEqual(original);
});

it("retains redirect and migration submissions with readable validation errors", async () => {
  const { host, admin, item } = await setup();
  const redirect = await host.admin.submit(
    "/redirects",
    "redirect-preview",
    {
      source: "/qa-bad",
      destination: "javascript:alert(1)",
      type: "302",
    },
    { user: admin },
  );
  const redirectText = JSON.stringify(redirect);
  expect(redirectText).toContain("Review your submission");
  expect(redirectText).toContain("Use an HTTP(S) URL without credentials");
  expect(redirectText).toContain('"initial_value":"/qa-bad"');
  expect(redirectText).toContain('"initial_value":"javascript:alert(1)"');
  expect(redirectText).toContain('"initial_value":"302"');
  expect(redirectText).not.toContain('\\"code\\":');
  const json = JSON.stringify([
    { source: "unknown", collection: "posts", id: item.id, meta: {} },
  ]);
  const migration = JSON.stringify(
    await host.admin.submit(
      "/migration",
      "migration-preview",
      { json },
      { user: admin },
    ),
  );
  expect(migration).toContain("Choose yoast or rankmath.");
  expect(migration).toContain(JSON.stringify(json));
  expect(await host.inspect.storage.list("changes")).toEqual([]);
  noError(
    await host.admin.submit(
      "/redirects",
      "redirect-preview",
      {
        source: "/qa-bad",
        destination: "/posts/garden-care",
        type: "302",
      },
      { user: admin },
    ),
  );
});
it("analyzes a host-attested unsaved draft without saving it", async () => {
  const { host, admin, item } = await setup();
  const draft = await host.admin.captureEditorDraft("posts", item.id, {
    title: "Unsaved title",
    excerpt: "Unsaved excerpt",
    body: [
      {
        _type: "block",
        _key: "b",
        style: "normal",
        children: [
          { _type: "span", _key: "s", text: "New draft text.", marks: [] },
        ],
        markDefs: [],
      },
    ],
  });
  const result = await host.admin.invokeEditorAction(
    "analyze-draft",
    "posts",
    item.id,
    { user: admin, draft },
  );
  expect(result.toast?.message).toContain("Unsaved draft checklist");
  expect((await host.inspect.content.get("posts", item.id))?.data.title).toBe(
    "Garden care",
  );
});

it.each([
  "",
  "not a URL",
  "https://",
  "javascript:bad",
])("loads editor, draft action and audit with unusable site URL %s", async (url) => {
  const { host, admin, item } = await setup(url);
  await host.fixtures.plugin.storage("entries", `posts:${item.id}`, {
    keyphrases: ["garden care"],
  });
  const panel = await host.admin.loadEditorPanel("quixseo", "posts", item.id, {
    user: admin,
  });
  noError(panel);
  const text = JSON.stringify(panel);
  expect(text).toContain("Site URL not configured");
  expect(text).toContain("EmDash → Settings");
  expect(text).toContain("Partial analysis");
  expect(text).toContain("Garden care");
  expect(text).toContain("⚪ N/A");
  expect(text).not.toContain("Invalid base URL");
  const draft = await host.admin.captureEditorDraft("posts", item.id, {
    title: "Unsaved garden care",
    excerpt: "Draft summary",
    body: [
      {
        _type: "block",
        _key: "a",
        style: "normal",
        children: [
          {
            _type: "span",
            _key: "s",
            text: "Garden care starts with the right amount of water. Check the soil and the drainage before changing how you water plants.",
            marks: [],
          },
        ],
        markDefs: [],
      },
    ],
  });
  const action = await host.admin.invokeEditorAction(
    "analyze-draft",
    "posts",
    item.id,
    { user: admin, draft },
  );
  expect(action.toast?.message).toContain("Site URL not configured");
  expect(action.toast?.message).toContain("partial analysis");
  await host.admin.act("/dashboard", "audit-start", { user: admin });
  const job = (await host.inspect.storage.list<AuditJob>("jobs"))[0];
  if (!job) throw new Error("Missing audit");
  for (let n = 0; n < 3; n++)
    noError(
      await host.admin.act("/dashboard", "audit-next", {
        user: admin,
        value: job.id,
      }),
    );
  const complete = await host.inspect.storage.get<AuditJob>("jobs", job.id);
  const report = (await host.inspect.storage.list<AuditRecord>("reports"))[0]
    ?.data;
  expect(report?.url).toBe("");
  expect(complete).toMatchObject({
    phase: "complete",
    processed: 1,
    incompleteAnalyses: 1,
    counts: { lowLinks: 0, orphan: 0 },
  });
  expect(complete?.error).toBeUndefined();
  expect(report).toMatchObject({
    url: "",
    incoming: null,
    analysis: { linksAssessed: false },
  });
  expect(JSON.stringify(report)).toContain("Site URL not configured");
});

it("recovers after the host updates site configuration and preserves keyphrases", async () => {
  const { host, admin, item } = await setup("");
  await host.fixtures.plugin.storage("entries", `posts:${item.id}`, {
    keyphrases: ["garden care"],
  });
  const load = () =>
    host.admin.loadEditorPanel("quixseo", "posts", item.id, { user: admin });
  expect(JSON.stringify(await load())).toContain("Site URL not configured");
  // The official fixture refreshes the host runtime after changing its setting.
  await host.fixtures.site({ url: "https://example.com" });
  const panel = await load();
  noError(panel);
  expect(JSON.stringify(panel)).not.toContain("Site URL not configured");
  expect(JSON.stringify(panel)).toContain(
    "https://example.com/posts/garden-care",
  );
  expect(
    await host.inspect.storage.get("entries", `posts:${item.id}`),
  ).toMatchObject({ keyphrases: ["garden care"] });
});

const h2 = {
  _type: "block",
  _key: "heading",
  style: "h2",
  children: [
    { _type: "span", _key: "hs", text: "Watering methods", marks: [] },
  ],
  markDefs: [],
};
it("reads saved unpublished revisions, removes headings, and returns a full explicit current-editor analysis", async () => {
  const { host, admin, item } = await setup();
  const initial = await host.inspect.content.get("posts", item.id);
  if (!initial) throw new Error("Missing content");
  const paragraphs = Array.from({ length: 5 }, (_, n) => ({
    ...(initial.data.body as Record<string, unknown>[])[0],
    _key: `paragraph-${n}`,
  }));
  expect(
    (
      await host.actions.content.update("posts", item.id, {
        data: { ...initial.data, body: paragraphs },
      })
    ).success,
  ).toBe(true);
  expect((await host.actions.content.publish("posts", item.id)).success).toBe(
    true,
  );
  const before = await host.inspect.content.get("posts", item.id);
  if (!before) throw new Error("Missing published content");
  const load = () =>
    host.admin.loadEditorPanel("quixseo", "posts", item.id, { user: admin });
  expect(JSON.stringify(await load())).toContain("Published content");
  const revised = {
    ...before.data,
    body: [h2, ...(before.data.body as unknown[])],
  };
  const updated = await host.actions.content.update("posts", item.id, {
    data: revised,
    actor: { id: admin.id, role: 100 },
  });
  expect(updated.success).toBe(true);
  const savedPanel = await load();
  noError(savedPanel);
  expect(JSON.stringify(savedPanel)).toContain(
    "Saved draft — unpublished changes",
  );
  expect(JSON.stringify(savedPanel)).toContain(
    "Body headings have no detected",
  );
  const live = await host.inspect.content.get("posts", item.id);
  expect(live?.data).toEqual(before.data);
  expect(live?.draftRevisionId).not.toBe(live?.liveRevisionId);
  const snapshot = await host.admin.captureEditorDraft(
    "posts",
    item.id,
    revised,
  );
  const current = await host.admin.actEditorPanel(
    "quixseo",
    "posts",
    item.id,
    "analyze-current",
    { user: admin, draft: snapshot },
  );
  noError(current);
  expect(JSON.stringify(current)).toContain("Current editor — unsaved changes");
  expect(current.blocks.filter((b) => b.type === "table")).toEqual(
    savedPanel.blocks.filter((b) => b.type === "table"),
  );
  expect(current.blocks.filter((b) => b.type === "stats")).toEqual(
    savedPanel.blocks.filter((b) => b.type === "stats"),
  );
  expect(
    (await host.actions.content.update("posts", item.id, { data: before.data }))
      .success,
  ).toBe(true);
  const removed = JSON.stringify(await load());
  expect(removed).not.toContain("Body headings have no detected");
  expect(removed).toContain("Saved draft — unpublished changes");
  const unsaved = await host.admin.actEditorPanel(
    "quixseo",
    "posts",
    item.id,
    "analyze-current",
    {
      user: admin,
      draft: await host.admin.captureEditorDraft("posts", item.id, revised),
    },
  );
  expect(JSON.stringify(unsaved)).toContain("Body headings have no detected");
  expect(JSON.stringify(await load())).not.toContain(
    "Body headings have no detected",
  );
});

it("delivers a translatable Portable Text field with a custom name to the explicit panel action", async () => {
  const { host, admin } = await setup();
  await host.fixtures.collection({
    slug: "pages",
    label: "Pages",
    supports: ["seo", "drafts", "revisions"],
    urlPattern: "/{slug}",
    fields: [
      { slug: "title", label: "Title", type: "string", translatable: true },
      {
        slug: "article_text",
        label: "Article",
        type: "portableText",
        translatable: true,
      },
    ],
  });
  const item = await host.fixtures.content("pages", {
    data: { title: "Watering", article_text: [] },
    slug: "watering",
    status: "published",
  });
  const draft = await host.admin.captureEditorDraft("pages", item.id, {
    title: "Watering",
    article_text: [h2],
  });
  const result = await host.admin.actEditorPanel(
    "quixseo",
    "pages",
    item.id,
    "analyze-current",
    { user: admin, draft },
  );
  noError(result);
  expect(JSON.stringify(result)).toContain("Body headings have no detected");
  expect(JSON.stringify(result)).not.toContain("snapshot does not include");
});

it.each([
  0, 1, 10, 80,
])("automatically completes %i published entries using persistent scheduled tasks, including restart", async (count) => {
  const { host, admin, item } = await setup();
  if (!count) {
    expect(
      (await host.actions.content.update("posts", item.id, { status: "draft" }))
        .success,
    ).toBe(true);
  }
  for (let n = 1; n < count; n++)
    await host.fixtures.content("posts", {
      data: { title: `Garden ${n}`, body: [h2] },
      slug: `garden-${n}`,
      status: "published",
    });
  noError(await host.admin.act("/dashboard", "audit-start", { user: admin }));
  const initial = (await host.inspect.storage.list<AuditJob>("jobs"))[0];
  if (!initial) throw new Error("Missing audit");
  if (count === 80) {
    expect(initial.data.phase).not.toBe("complete");
    expect((await host.inspect.scheduledTasks()).length).toBeGreaterThan(0);
    await host.restart();
  }
  const now = Date.now();
  let job = initial.data;
  for (let n = 1; n <= 20 && job.phase !== "complete"; n++) {
    host.scheduled.setTime(new Date(now + n * 60000));
    await host.scheduled.run();
    job = (await host.inspect.storage.get<AuditJob>(
      "jobs",
      initial.id,
    )) as AuditJob;
  }
  expect(job).toMatchObject({
    phase: "complete",
    processed: count,
    assessed: count,
    scored: count,
  });
  expect((await host.inspect.storage.list<AuditRecord>("reports")).length).toBe(
    count,
  );
  expect(await host.inspect.scheduledTasks()).toHaveLength(0);
  let results = await host.admin.act("/dashboard", "audit-results", {
    value: job.id,
    user: admin,
  });
  noError(results);
  expect(JSON.stringify(results)).toContain("SEO audit results");
  expect(JSON.stringify(results)).toContain("Back to audit");
  if (count === 80) {
    for (let page = 1; page < 4; page++) {
      const next = results.blocks
        .flatMap((b) => (b.type === "actions" ? b.elements : []))
        .find((e) => e.type === "button" && e.action_id === "reports-next");
      if (next?.type !== "button") throw new Error("Missing next page");
      results = await host.admin.act("/dashboard", "reports-next", {
        user: admin,
        value: next.value,
      });
      noError(results);
    }
    const titles = (r: typeof results) => {
      const table = r.blocks.find((b) => b.type === "table");
      if (table?.type !== "table") throw new Error("Missing audit table");
      return table.rows.map((row) => String(row.title));
    };
    const before = titles(results);
    const form = results.blocks.find((b) => b.type === "form");
    if (form?.type !== "form") throw new Error("Missing page options");
    const sorted = await host.admin.submit(
      "/dashboard",
      form.submit.action_id,
      { filter: "all", sort: "title" },
      { user: admin, blockId: form.block_id },
    );
    noError(sorted);
    expect(titles(sorted)).toEqual(
      [...before].sort((a, b) => a.localeCompare(b)),
    );
    const reapplied = await host.admin.submit(
      "/dashboard",
      form.submit.action_id,
      { filter: "all", sort: "lowest-score" },
      { user: admin, blockId: form.block_id },
    );
    noError(reapplied);
    expect(titles(reapplied).sort()).toEqual([...before].sort());
    const next = sorted.blocks
      .flatMap((b) => (b.type === "actions" ? b.elements : []))
      .find((e) => e.type === "button" && e.action_id === "reports-next");
    if (next?.type !== "button")
      throw new Error("Missing next page after sorting");
    expect(next.value).toMatchObject({ filter: "all", sort: "title" });
    const advanced = await host.admin.act("/dashboard", "reports-next", {
      user: admin,
      value: next.value,
    });
    noError(advanced);
    expect(titles(advanced).every((title) => !before.includes(title))).toBe(
      true,
    );
    const mismatched = await host.admin.submit(
      "/dashboard",
      `reports-filter:${crypto.randomUUID()}`,
      { filter: "all", sort: "title" },
      { user: admin, blockId: form.block_id },
    );
    expect(JSON.stringify(mismatched)).toContain("Audit page does not match");
  }
}, 120000);

it("saves ordinary settings in one sandboxed form submit, detects stale forms and preserves draft state", async () => {
  const { host, admin } = await setup();
  const item = await host.fixtures.content("posts", {
    data: { title: "Draft garden" },
    slug: "draft-garden",
    status: "draft",
    authorId: admin.id,
  });
  const panel = await host.admin.loadEditorPanel("quixseo", "posts", item.id, {
    user: admin,
  });
  const form = panel.blocks.find((b) => b.type === "form");
  if (form?.type !== "form") throw new Error("Missing settings form");
  const values = Object.fromEntries(
    form.fields.map((f) => [
      f.action_id,
      "initial_value" in f ? f.initial_value : "",
    ]),
  );
  expect(values).not.toHaveProperty("title");
  const otherAuthor = await host.fixtures.user({
    email: "other-author@example.test",
    role: "author",
  });
  await expect(
    host.admin.submitEditorPanel(
      "quixseo",
      "posts",
      item.id,
      form.submit.action_id,
      values,
      { user: otherAuthor },
    ),
  ).rejects.toThrow();
  const saved = await host.admin.submitEditorPanel(
    "quixseo",
    "posts",
    item.id,
    form.submit.action_id,
    { ...values, keyphrases: "draft garden", ogTitle: "Garden override" },
    { user: admin },
  );
  expect(saved.toast?.type).toBe("success");
  await host.restart();
  const refreshed = await host.admin.loadEditorPanel(
    "quixseo",
    "posts",
    item.id,
    { user: admin },
  );
  expect(JSON.stringify(refreshed)).toContain("draft garden");
  expect(JSON.stringify(refreshed)).toContain("Garden override");
  expect(JSON.stringify(refreshed)).toContain("Saved draft");
  const stale = await host.admin.submitEditorPanel(
    "quixseo",
    "posts",
    item.id,
    form.submit.action_id,
    { ...values, keyphrases: "stale edits" },
    { user: admin },
  );
  expect(stale.toast?.type).toBe("error");
  expect(JSON.stringify(stale)).toContain("stale edits");
  expect(JSON.stringify(stale)).toContain("changed since this form");
  const plans = await host.inspect.storage.list<ChangePlan>("changes");
  expect(plans).toHaveLength(1);
  expect(plans[0]?.data.rows[0]?.status).toBe("applied");
  expect(plans[0]?.data.rows[0]?.afterSeo).toEqual(
    plans[0]?.data.rows[0]?.beforeSeo,
  );
});

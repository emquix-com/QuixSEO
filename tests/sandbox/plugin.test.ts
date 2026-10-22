import type { PluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import { createPluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import { afterEach, describe, expect, it } from "vitest";
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

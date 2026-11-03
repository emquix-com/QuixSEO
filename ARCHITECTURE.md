# QuixSEO architecture

Research date: 2026-10-20. Target: EmDash 1.3.1 (npm stable), plugin-cli
0.13.4, plugin-test 0.2.10, sandbox-workerd 0.9.5. Exact reference commits
are recorded in [research/sources.json](research/sources.json). This document
was created before application implementation. Release status is pre-release.

## Verified platform contract

Primary evidence: the EmDash repository's `packages/core/src/plugins/types.ts`,
`plugin-types.ts`, `plugins/context.ts`, `page/metadata.ts`, `page/seo-panel.ts`,
`packages/plugin-types`, `packages/blocks`, and official documentation in
`docs/src/content/docs/plugins/creating-plugins/` (format, hooks, Block Kit,
capabilities, storage, testing, manifest and publishing), plus `guides/seo.mdx`.
The official site is https://docs.emdashcms.com/.

* EmDash is Astro-based, with schema-defined collections, Portable Text,
  saved drafts/live revisions, locale-specific rows, and SQLite/D1/Postgres
  adapters. No WordPress database or hook assumptions apply.
* Registry plugins use `emdash-plugin.jsonc` and a default `SandboxedPlugin`
  export. The official CLI builds the manifest and isolate bundle by probing
  declared hooks/routes. Registry publishing needs a verified Atmosphere
  publisher, distinct from GitHub ownership. It must not be invented.
* Native `definePlugin()` and React admin entrypoints are not required.
  Block Kit returns validated declarative JSON with host-owned controls.
  Pages share the `admin` route. Private routes have explicit host permission
  declarations, CSRF protection, and authenticated caller context.
* Editor extensions have host-attested entry identity and ownership checks.
  Initial panel load is saved-only. Current source also describes opt-in draft
  read snapshots on explicit actions, constrained by collection and fields.
  Availability must be checked against the installed stable package.
* `content:read` exposes paginated content, SEO panel values and public URL
  resolution. `schema:read` discovers collections and fields. `content:write`
  declares native `seo` writes in the native context, but the installed sandbox
  bridges fail to handle them. Integration testing disproved support; see below.
  There is no atomic conditional SEO update in the examined API. SEO-only
  writes do not bump content version: comparing version alone is unsafe.
* Plugin storage has indexed, cursor-paginated queries and revision-based
  compare-and-set. Use it for settings, analysis snapshots, immutable change
  previews, progress and journals. Do not store entire site datasets in KV.
* Core owns SEO title, description, canonical, social image and noIndex;
  noIndex also excludes entries from sitemaps/hreflang. Reuse these fields.
  Core owns sitemap pagination, robots.txt, verification tags, locale links,
  slug-change redirects and the original-path 404 log.
* `page:metadata` accepts meta, property, allowlisted link and JSON-LD
  contributions. First contribution per key wins. Use JSON-LD id `primary`
  to replace the core graph. No raw HTML, scripts, fragments or second
  canonical emitter. `<title>` remains the theme's responsibility, using
  `getSeoMeta()`. Templates are preview-only until the sandbox bridge supports native writes.
* `redirects:write` includes reads and revision-guarded writes. The sandbox
  context does not expose the core 404 log: link users to core Redirects.
  Do not infer visitor paths from a rewritten `/404` metadata event.
* No outbound network permission is needed for local content analysis.
  Public metadata must never scan content, crawl URLs, or read draft bodies.
  Internal link checks mean known content targets, not HTTP status checks.
* Isolated runner defaults include 30s wall time; Cloudflare additionally
  enforces CPU/subrequest budgets. Block Kit bounds include 256 KiB total,
  64 KiB strings, 1,000 array entries, 2,000 nodes, depth 20. Keep batches
  small and progress resumable. Never promise unlimited work per invocation.

## Independent reference findings

Yoast (GPLv3): editor-centered assessments, explainable traffic lights,
search previews, focus phrase, separate readability, cornerstone concepts,
and graph identity. Evidence: `inc/class-wpseo-meta.php`, assessment inventory
in `packages/yoastseo/src/scoring`, and export components. Its successful
workflow keeps actionable feedback next to writing, separates SEO from
readability, and leaves editorial decisions to the author.

Rank Math (GPLv3+): independently switchable modules, multiple phrases,
site analysis, redirect/404 tools, schema controls and migration. Evidence:
`includes/modules`, `includes/admin/importers/class-yoast.php`, settings
import/export and redirect exporters. Do not reproduce its power-word,
number-in-title or content-length incentives. Its analyzer package declares
ISC in package.json but contains WordPress-related dependencies and lacks
a root LICENSE in this checkout; no code or dependencies from it are reused.

The jdevalk plugin (MIT, 0.12.0) is a native plugin with React administration,
metadata and linked schema, hreflang, IndexNow, experimental discovery files
and fuzzy redirect suggestions. Its README version requirement differs
from package.json; inspect source rather than trusting that requirement.
Its private settings routes cast inputs and its metadata hook uses native
helpers. QuixSEO uses a sandbox-first contract and adds editorial analysis,
bounded audits, linking, reviewed bulk changes and migration journals.
No reference repository source or visual assets are copied into QuixSEO.

## Design

1. Pure TypeScript domain modules: validation, Portable Text extraction,
   deterministic SEO/readability rules, templates, schema, link graphs,
   redirect checks and migration mapping.
2. EmDash adapter services: storage validation, content reads/writes, bounded
   jobs and change journals. Every write uses explicit entry identity;
   changes never publish an entry or modify its body.
3. Block Kit views: onboarding/settings, dashboard/audit, editor, bulk
   preview/history, linking, migration and redirects. Every displayed
   metric comes from actual stored analysis; unknown is not zero.
4. Metadata hook: at most bounded settings/per-entry reads, native SEO
   fallback, optional social overrides and validated linked schema.
   Analysis remains usable when metadata output is disabled for coexistence.

The score is an editorial checklist, never a ranking prediction. Rules have
stable identifiers, explicit severity and recommendations. English linguistic
rules are opt-in/locale-gated; structural rules can run in any language.
Unknown/custom rich blocks are reported as coverage limits, not fabricated
text. No minimum word count or keyword-density target earns points.

Bulk/migration operations require a persisted preview and confirmation. Store
before/after values, actor, input fingerprint and progress. Re-read SEO and
plugin revisions before each mutation, preserve unrelated fields, stop on
conflict, and only roll back values still matching the recorded result.
Plugin-owned data supports atomic CAS. All plans containing native SEO changes
are blocked before mutations, both because the bridge cannot perform them and
because native concurrency needs an upstream conditional-write contract.

Audits run in bounded pages and separate collection scanning from graph
evaluation. Store generation IDs so partial scans cannot masquerade as
complete. Incoming links and orphan candidates describe analyzed published
content only; themes, navigation and external links are outside this graph.

## Release and verification boundary

Pin dependencies and test the published API, not just main-branch source.
Use pure unit tests, the official plugin-test production sandbox boundary,
real runtime authorization tests, and a disposable Astro/EmDash site for
browser/editor/public rendering journeys. Test metadata deduplication with
a second emitter. Node/workerd and deployed Cloudflare limits are distinct
checks. Record what actually ran in docs/TEST-RESULTS.md.

AI, remote crawling, analytics accounts, automatic redirects and automatic
publishing are excluded from the first milestone. No network or secret
permission is requested for absent features. 1.0.0 and registry publication
remain blocked until all acceptance criteria and verified publisher identity
are satisfied. No release workflow publishes automatically.

## Integration findings — 2026-10-21

The official production sandbox exposed two assumptions that were corrected:
`seo` is treated as an unknown collection field by the bridge, and content list
sorting does not accept `id`. QuixSEO now refuses native SEO mutations, drops
`content:write`, and uses supported `createdAt` pagination. No privileged native
workaround was added. docs/compatibility.md records the exact impact.

The real test site required a compatible adapter and aligned Astro/Vite versions.
The lockfile pins the installed runtime. The native panel remains responsible
for SEO title/description/canonical/image/indexing writes. Plugin-owned config
is live configuration, not revisioned content: an editor's confirmed social or
schema change can affect a currently published page immediately without
publishing its body. The UI and documentation must make that distinction clear.

## Draft and background execution — 2026-10-26

Verified against installed EmDash 1.3.1 and the reference source: `plugins/types.ts`
(revision and draft contracts), plugin context/bridge `getRevision`, `cron`
executor and scheduler, and Block Kit types. See [the implementation contract](docs/editor-and-audits.md).
`editor-content.ts` resolves only the current entry's draft pointer and keeps
analysis separate from public metadata. Explicit editor actions receive authorized
snapshots; panel loads do not. Static draft selectors require explicit collections.

The `cron` hook resumes plugin-scoped persisted jobs in bounded batches. A recurring
task is used because re-arming a same-name one-shot inside its callback would race
with EmDash's post-callback deletion. Jobs retain their own CAS/lease protection
in addition to host task claims. Reports use create-only snapshots, stable edge
keys, and atomic cursor/counter commits for replay. Transient failure backoff and
terminal cleanup prevent immediate retry loops. No browser polling drives work.

The expanded backend exceeded the registry's 128 KiB per-file cap with classic
Zod. The same pinned Zod dependency's Mini API preserves schemas/checks/defaults
with a smaller bundle. `#validation` resolves via package imports in tests and a
TypeScript path during CLI builds; plugin-cli 0.13.4 otherwise externalizes
`zod/mini`, which is unusable in the isolate. No host/tooling patches are used.

## llms.txt on EmDash 1.4

The verified 1.4 raw-route contract (`response: "raw"`, `pluginResponse` text
body) permits a public GET/HEAD endpoint named `llms-txt`. Route names cannot
contain dots; all sandbox endpoints are mounted under `/_emdash/api/plugins/`.
The generated manifest declares this public surface. No capabilities are added.
Admin-only configuration uses a separate plugin-scoped `settings/llms` key;
default-disabled public requests perform no content reads. Enabled requests read
fresh published entries through `content:read` and collection metadata through
`schema:read`, with fixed scan, collection and byte budgets. No revision reads,
audit-cache reuse, filesystem writes, or network requests are involved.

Core `src/astro/routes/robots.txt.ts` reads core's `seo.robotsTxt` setting and
adds sitemap/training rules. There is no supported sandbox robots hook or
core-settings-write permission. The UI supplies a manual informational comment,
not an invented `Llms:` directive. The optional Astro route example internally
rewrites `/llms.txt` to the raw sandbox endpoint. It belongs to the hosting site,
not the registry bundle. See [setup and limitations](docs/llms-txt.md).

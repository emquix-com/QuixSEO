# Verification history

## 2026-11-04 — current release preparation

The planned public version is 0.0.1. Earlier sections below describe development
builds and retain their original test counts, environments and checksums. They
are historical records, not claims that the final 0.0.1 archive has passed.

- Publisher emquix.com and DID did:plc:6clqzka76ueshbureaecbrfj verified; official
  CLI login confirmed the matching identity.
- [Linux production smoke run 41812539727](https://github.com/emquix-com/QuixSEO/actions/runs/41812539727)
  passed commit 4c8780a on Linux/Node 24.22.1, EmDash 1.4.0 and Chromium
  156.0.8078.4. All 11 regression and 4 llms.txt workflow checks passed, with no
  recorded browser errors/failed requests. Sandbox load, disabled development
  bypasses and completed audit/content persistence after restart were verified.
  Archive SHA256: 74641d6141a423dbf2db3198798668df8349db5979dc84561465c2f803840b90.
- Authentication reused a native session created during disposable development
  setup; fresh production signup/login/recovery was not certified.
- Audit-page sorting fix 7240f49 passed TypeScript/lint, 157 unit tests,
  27 official sandbox tests, validation/build/bundle and real-browser page-four
  checks. Title sorting/filtering retained all nine entries on the last page;
  next-page navigation retained ordering. CI passed that commit.
- The local clean host exercised 38 published entries across Posts/Pages, audit
  and bulk pagination, role restrictions, social/schema edges and synthetic
  migration rollback. These checks do not certify arbitrary site scale or real
  source-plugin exports.

Windows development was exercised; Windows standalone production still failed
sandbox loading on the tested runner. Deployed Cloudflare remains untested and
requires Workers Paid for sandboxed plugins. No registry publication or registry
installation/update has been verified. Run the production smoke workflow again
on the final 0.0.1 release commit and record that artifact's checksum.

## 2026-11-03 — optional llms.txt generation

Built on upstream `f9b3e50` (including the user's EmDash 1.4 and editor-save
changes), using Node 24, Linux Chromium and the disposable Node/workerd site.
The Windows `test-site/astro.config.mjs` was not edited.

| Check actually run | Result |
| --- | --- |
| `npm run check` | Passed: types, Biome, 157 unit tests, official manifest validation and build |
| `npm run test:sandbox` | 27 passed, including 4 new real public-route/configuration tests |
| `npm run test:imports` | 3 passed |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser:llms` | 4 workflow groups passed: persistence, preview, anonymous root/API/HEAD/download, disable and unchanged robots.txt |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` | All 11 existing editor/bulk/rollback/metadata/audit workflow groups passed |
| `npm run bundle` | Validated: 243.9 KB unpacked, 138.2 KB tarball; backend 115,103 bytes, within platform limits |
| `git diff --check` | Passed |

The 18 new unit cases cover opt-in behavior, published-only eligibility, invalid
URLs, collection selection, freshness, unsafe/off-site URLs, bounded scans and
UTF-8 output, stuck/empty pagination, Markdown escaping, request validation and
administrator authorization. Production-compatible D1/Worker Loader tests verify
that a saved unpublished title does not leak, and exercise native noindex changes,
unpublishing, disabling, permission denial and Site URL recovery.

The first sandbox run exposed incorrect query construction in the **test host
call** (a query was appended to the route name rather than the request URL). The
test was corrected to use the host's `url` argument; the full suite then passed.
The real browser independently verified download query handling at `/llms.txt`.

Browser artifacts are local in ignored `test-results/llms/` and
`test-results/regressions/`. The llms.txt settings were restored, and the existing
journey's temporary article was unpublished with plugin overrides cleared.
No registry publication or deployed Cloudflare test was performed. The optional
root route and robots.txt manual setup are documented in [llms.txt](llms-txt.md).

## 2026-11-03 — Windows QA fixes and EmDash 1.4.0

Windows, Node 24.20.0, npm 11.19.0, Astro 7.4.2, Edge 156.0.4314.58 and
Playwright 1.64.1. The local site was upgraded from EmDash 1.3.1 to 1.4.0 with
blocks 1.4.0, plugin-cli 0.13.5, plugin-test 0.2.11 and sandbox-workerd 0.9.6.
The existing SQLite data and Windows-specific configuration were preserved.

| Check actually run | Result |
| --- | --- |
| Fixes before upgrade on 1.3.1 | 139 unit tests and 23 sandbox tests passed; real browser verified sparse bulk preservation, rollback and retained redirect inputs |
| `npm run check` on final 1.4 dependencies | Passed: types, lint, 139 unit tests, manifest validation and build |
| `npm run test:sandbox` | 23 passed, including multi-entry sparse bulk updates and validation recovery |
| `npm run test:imports` | 3 passed using the portable Python launcher |
| `npm run test:browser` | 11 local Node/workerd workflow groups passed; no console errors or failed responses in the instrumented run |
| Separate native-write sandbox probe | Native SEO update still rejected as unknown field; isolated fixture unchanged |
| `npm audit` | Zero reported vulnerabilities after targeted compatible patches; no `npm audit fix` used |
| `npm run bundle` | Validated: 236.7 KB unpacked, 135.5 KB tarball; backend 108,205 bytes, within platform limits |
| Original data/config integrity | Original two posts and draft page API records unchanged; Windows config SHA256 unchanged |

The three verified local QA failures are resolved: bulk partial-update data
preservation, form recovery after redirect validation errors, and the upstream
nested-form warning (fixed by EmDash 1.4). Browser coverage also includes stale
editor submissions, migration validation, native write refusal, deduplicated
public metadata and automatic audit completion. Blank schema defaults no longer
appear as false before/after changes.

The first browser run passed the functional groups but reported an unidentified
resource 404 on the strict console assertion. The instrumented rerun passed all
11 groups with zero failed responses or console errors. This is recorded as a
transient diagnostic, not silently filtered out.

Native metadata writes remain preview-only; neither a privileged fallback nor
content-write permission was added to QuixSEO. Real WordPress source data was not
available. Permanent redirect deletion was not made recoverable by the upgrade.
Live pagination/large-site and deployed Cloudflare certification are not claimed.
The two new regression entries were unpublished and left as clearly labeled
drafts with plugin overrides cleared; historical audits/journals were retained.

Detailed local artifacts are in `qa-results/fixes-1.4/`, including the follow-up
report, real-browser screenshots/results, original-record comparison, database
backup, security audit and isolated probe output. These local artifacts and the
pre-existing Windows config edit are excluded from the Git commit. See
[compatibility](compatibility.md) and [release preparation](release.md) for the
remaining native-write and registry-identity boundaries. No release or deployment
was performed.

## Draft workflow and automatic audit validation — 2026-10-26

Target: EmDash 1.3.1, Node 24.19.0; the same pinned official CLI, sandbox runner
and test host as the historical reports. This is historical development-build evidence, not certification of the final release.

| Check actually run | Result |
|---|---|
| `npm run check` | Passed: strict types, Biome, 134 unit tests, official manifest validation and build/probe |
| `npm run test:sandbox` | 20 passed with the production-compatible Worker Loader / D1 host |
| `npm run test:imports` | 3 passed |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` | 9 real Node/workerd workflow groups passed, including results/link navigation |
| `npm run bundle` | Passed: 225.6 KB unpacked, 131.2 KB compressed; backend 98.25 kB (CLI build units) |
| `git diff --check` | Passed |

New unit regressions cover current-entry revision selection, missing/denied/wrong
revision fallback, configured body fields, explicit unsaved snapshots, matching
saved/current scores and coverage, 0/1/10/120 posts plus a second collection,
scan and assessment write interruption, delayed retries and failure recovery,
concurrent workers, cancellation, expired leases, unavailable scheduling, legacy
scoring jobs, results navigation, candidate pagination beyond 100, and single vs
multiple-entry review labels. Existing score/performance, metadata, validation,
schema, redirect, import and change-protection tests remain in the passing suite.

New sandbox tests save and remove H2 revisions without publishing, compare full
saved/current checklists and scores, verify the published body stays unchanged,
and deliver a custom translatable Portable Text field to the sidebar. Automatic
audit tests cover 0, 1, 10 and 80 published entries; the 80-entry job survives a
host restart and finishes solely through scheduled-task invocations. Counts and
records match eligible entries; terminal jobs remove their scheduled tasks.
Existing authorization, unpublished-content exclusion, migration rollback,
native-write refusal and conditional conflict tests pass unchanged in substance.

The real Chromium journey exercises the explicit sidebar action, Apply changes /
Revert change, public OG/schema output and tag deduplication, automatic review
completion, View audit results, direct single-article findings, link-suggestion
empty state and Back navigation. Screenshots were refreshed from that site.
The test waits for the new start response rather than accepting a previous
completed audit. An intermediate browser failure exposed accordion state reuse;
single-article findings now render directly, and the journey was rerun.

EmDash still logs its existing nested-form console warning in the editor; no
uncaught page exceptions were reported, and the tested actions work. No core or
CSS workaround was added. Linux Chromium and production-compatible sandbox tests
do not certify Windows or a deployed Cloudflare scheduler. The user's Windows
`test-site/astro.config.mjs` was not changed.

The classic validation build initially exceeded EmDash's 128 KiB backend limit.
Switching to the same pinned Zod dependency's Mini API and bundling it through a
local build alias fixed packaging without dropping validation or adding a runtime
dependency. All suites above ran with the Mini implementation.

Package SHA-256:
`37fa954feccb75c405c484b966a1d4393528aeb8323cffc8414066467b46b59b`.

Remaining limits and suggested manual cases: [editor/audit workflows](editor-and-audits.md).
The added permission is `content:revisions:read`; no content-write, network or
extra cron capability is requested. No release or registry submission was made.

---

# URL handling and scoring validation — 2026-10-22

Updated from upstream `05390dc37916093000991e488c50f428b5c77c95` without
reverting its preview/rollback improvements or compact status badges.
Environment versions remain those listed in the historical report below.
This remains historical development-build evidence, not final-release certification.

| Check actually run for this change | Result |
|---|---|
| `npm run check` | Passed: strict types, Biome, 115 unit tests, official manifest validation and build/probe |
| `npm run test:imports` | 3 passed |
| `npm run test:sandbox` | 14 passed against the official Worker Loader runtime |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` | 8 real Node/workerd browser workflow groups passed |
| `npm run bundle` | Passed; 239.2 KB unpacked / 123.0 KB compressed, below the 256 KB unpacked cap |
| `git diff --check` | Passed |

The 41 additional unit cases cover unusable URLs, public-URL preference,
malformed-base artifacts, recovery without plugin reinitialization, preserved
unrelated errors, canonical resolution, distinct article shapes, optional
neutrality, actual score improvements, metadata provenance, incomplete coverage,
English/French/Japanese behavior and draft settings. The updated existing tests
also exercise legitimate N/A states rather than vacuous passes. The 10,000-entry
pure-analyzer performance guard remains in the passing unit suite; this is not a
production database benchmark.

Five new sandbox cases cover empty/malformed site settings across the real
editor, draft action and resumable audit, and recovery when the host refreshes
its settings. They verify no fabricated route, no false missing-link/orphan
counts, preserved keyphrases and completion without a URL exception. The existing
nine permission, metadata, preview, conflict, migration and rollback cases pass.
The official site-setting fixture restarts its host runtime internally; the
separate unit lifecycle test proves QuixSEO itself does not cache the URL.

The browser journey verifies the current upstream review UI, new coverage text,
N/A badge and absent-image explanation, plus existing save/rollback behavior and
exactly one canonical, description, OG title and JSON-LD graph in public HTML.
The editor and audit screenshots were regenerated from this functioning site.

The first new sandbox run found that EmDash's trailing-slash normalization can
turn the invalid site setting `https://` into the invented host
`https://posts/garden-care`. The fix was added and the full sandbox suite rerun
successfully. Intermediate failures are not reported as passes.

The old and new analyzers were both executed against identical documented
fixtures; see [SCORING-AUDIT.md](SCORING-AUDIT.md#measured-implementation-results).
The 173-word reconstruction gives 97/96 before and 79/79 after, or 71 with an
excerpt-only description. It is not the user's unavailable original article.

Current local package SHA-256:
`37b9bb597226990eba5cb37538bd2b84a2aec182a39c1bb6c24d4932dd04dadc`.
No registry submission or public release was made. Deployed Cloudflare behavior
and the other release gaps below remain unverified. No dependencies, permissions,
metadata generation or change-journal semantics were changed by this task.

---

# Historical test results — 2026-10-21

This records a historical development artifact predating 0.0.1, not final-release certification.
Environment: Linux x64, Node 24.19.0, EmDash 1.3.1, plugin-cli 0.13.4,
plugin-test 0.2.10, sandbox-workerd 0.9.5, Astro 7.4.2, Vite 8.3.5,
Vitest 4.1.11, Playwright 1.64.1 and system Chromium.

| Check actually run | Result |
|---|---|
| Strict TypeScript | Passed |
| Biome lint/format | Passed |
| Unit tests | 69 passed |
| Official Worker Loader production sandbox | 9 passed |
| Python WXR converter | 3 passed |
| Real Node/workerd browser journey | 8 checks passed |
| Official registry-format bundle | Passed, 222.0 KB unpacked / 115.9 KB tarball |
| Official manifest validation | Passed with development publisher |
| Runtime dependency audit (`npm audit --omit=dev`) | 0 reported vulnerabilities |
| Official build/probe | Passed; metadata hook and 3 routes detected |

The unit suite covers scoring rules, extraction, language gating, safe URLs,
canonical normalization, native relative/media references, templates, all ten
schema types, redirect conflicts and loops, import warnings and actual EmDash
metadata resolution/escaping. The performance case analyzes 10,000 small
representative documents; it is not a large database or deployed CPU benchmark.

The sandbox suite uses actual content/storage and the production dispatch
boundary: all six pages, saved editor, authentication, ownership, forged editor
context, preview/confirmation, resume, conflicts, rollback, reversible phrase
migration, saved versus unsaved draft handling, metadata opt-out and refusal of
native SEO changes. The audit test resumes after host restart, excludes a private
draft and checks incoming links from a fragment-bearing internal URL.

The browser script (`tests/browser/smoke.mjs`) ran against the included disposable
site and exercised:

1. Plugin registration in native navigation and setup save.
2. Core API creation/update and publication of real Portable Text content.
3. Authorized editor panel rendering and content-derived analysis.
4. Preview/confirm of keyphrases, social metadata and BlogPosting configuration.
5. Anonymous public HTML reflecting those changes and conditional rollback.
6. Exactly one canonical, description, OG title and primary JSON-LD graph.
7. Valid graph IDs without the legacy workerd empty-fragment defect.
8. A completed resumable audit plus bulk/migration/redirect/history screen loads.

The eight automated result groups combine some steps above. Real screenshots
are [setup](screenshots/settings.jpg), [editor](../screenshots/editor.jpg),
and [audit](../screenshots/dashboard.jpg). The fixture is intentionally small.
Publishing used the real core API; a complete keyboard-only publish journey,
responsive accessibility audit and every import/redirect UI interaction are
still pending. A host Base UI uncontrolled-field warning was observed during
form replacement, without a browser page exception or failed save.

## Failures found and corrected

- Native `seo` writes failed in the actual sandbox. They are now blocked before
  plugin mutations and explicitly marked preview-only. This remains a platform
  release blocker, not a successful native write test.
- Unsupported `id` sorting was replaced with supported `createdAt` pagination.
- Node/workerd URL hash setters produced trailing `#` and doubled schema
  fragments; serialized normalization and real sandbox regressions now cover it.
- Rank Math canonical mapping was corrected to `rank_math_canonical_url`.
- Native media IDs/relative paths are preserved instead of treated as invalid
  absolute URLs. Plugin-owned URL fields retain stricter validation.
- The disposable site needed an aligned Astro/Vite/Node adapter and the required
  EmDash live loader. Initial failed starts and 404s are not counted as passes.

## Not established

No deployed Cloudflare certification, actual competing plugin installation,
complete rich-result validator certification, transactional native bulk edits,
remote crawl, production-scale database benchmark or independent security review
has been completed. Registry eligibility and publisher ownership are not
established by offline CLI validation. See compatibility.md and ROADMAP.md.

## Historical acceptance ledger (2026-10-21)

| Criterion | Status |
|---|---|
| Real installation | Local Node/workerd demonstrated |
| Functional primary admin | Development workflows demonstrated; finished bulk/schema UX pending |
| Actual content analysis | Demonstrated |
| Recommendations use real data | Demonstrated within documented extraction limits |
| Metadata/schema public output | Demonstrated locally |
| No duplicate SEO tags | Core resolver and real single-plugin output demonstrated; competitor test pending |
| Bulk validation/conflicts | Plugin data demonstrated; native changes blocked |
| Sensitive operation permissions | Sandbox role/ownership tests passed; independent review pending |
| Larger collections | Pure analyzer benchmark only; database/runtime limits pending |
| Automated/integration tests | Current implemented-scope suites passed |
| Accurate documentation | Implemented scope and gaps documented |
| Official manifest tooling | Offline validate/build; publisher identity unresolved |
| No release blockers | Not met: native SEO/platform and remaining product/QA gaps |
| Remaining limits documented | Yes |

Historical local package SHA-256:
`3551dd9881513ae49271bc1e4ecf4e2cc1b7107d009d47fb40c218622805002b`.
The first screenshot-inclusive package exceeded the CLI's 256 KB cap. The final
package uses two real JPEG captures; the setup screenshot remains in source docs.
Zod 4.3.6 was the only non-development dependency in that historical build and is MIT-licensed; its full
notice and QuixSEO's original MIT notice are included in the bundled README.
The dependency audit is an advisory check, not an independent security audit.

## Editor integration and EmQuix refinement — 2026-10-29

Environment: isolated Linux checkout, Node 24.19.0, locked EmDash 1.3.1.

- `npm run check`: passed (138 unit/integration tests, TypeScript, Biome,
  manifest validation and build).
- `npm run test:sandbox`: passed (21 official Worker Loader tests). Includes
  one-submit settings save, restart persistence, draft state, stale-form input
  retention and entry ownership enforcement, plus existing rollback/audit tests.
- `npm run test:imports`: passed (3 Python tests).
- `npm run bundle`: passed; artifact built locally, not published.
- `npm run test:browser`: passed (9 checks) with installed Chromium and the
  documented `npm run dev:site -- --ignore-lock` invocation. Verified anonymous
  HTML, current-editor analysis, one-click save followed by reload, history
  rollback and automatic audit completion. Initial startup attempts timed out
  without `--ignore-lock`; an intermediate test needed to reopen EmDash's
  collapsed panel after reload. Both were resolved before the passing run.
- Reviewed the actual captured sidebar at approximately 350px wide: vertical
  statistics and separate action rows remain readable. No custom CSS was added.


Actual QuixSEO metadata contributions are tested through EmDash's metadata
resolver/renderer with native fallbacks: one description, canonical, each OG/X
key and primary JSON-LD entry. The plugin does not emit a title element. This
checks resolver output; the browser additionally verifies one title, description,
canonical, OG/X text tags and primary schema on the real test-site page. Arbitrary
themes that manually emit extra tags are outside this guarantee.

No changes to scoring model 2 or the candidate matching algorithm. No native
metadata writes, content publication, content-revision writes, storage migration,
database reset, deployment or registry release. Windows-specific test-site
configuration was not accessed or changed; tracked astro.config.mjs is untouched.

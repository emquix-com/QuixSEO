# Draft workflow and automatic audit validation — 2026-10-26

Target: EmDash 1.3.1, Node 24.19.0; the same pinned official CLI, sandbox runner
and test host as the historical reports. This is an alpha, not 1.0 certification.

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
This remains an alpha, not a 1.0 release certification.

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

This is evidence for **0.1.0-alpha.1**, not a production/1.0 certification.
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

## 1.0 acceptance ledger

| Criterion | Status |
|---|---|
| Real installation | Local Node/workerd demonstrated |
| Functional primary admin | Alpha workflows demonstrated; finished bulk/schema UX pending |
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
Zod 4.3.6 is the only non-development dependency and is MIT-licensed; its full
notice and QuixSEO's original MIT notice are included in the bundled README.
The dependency audit is an advisory check, not an independent security audit.

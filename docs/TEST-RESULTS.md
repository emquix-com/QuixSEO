# Test results — 2026-10-21

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

Final local package SHA-256:
`3551dd9881513ae49271bc1e4ecf4e2cc1b7107d009d47fb40c218622805002b`.
The first screenshot-inclusive package exceeded the CLI's 256 KB cap. The final
package uses two real JPEG captures; the setup screenshot remains in source docs.
Zod 4.3.6 is the only non-development dependency and is MIT-licensed; its full
notice and QuixSEO's original MIT notice are included in the bundled README.
The dependency audit is an advisory check, not an independent security audit.

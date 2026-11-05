# Changelog

## 0.0.2 — published 2026-11-05

- Credit EmQuix with https://emquix.com as the public package and listing author.
- Add the approved EmQuix SEO icon, with the smaller shared plugin-family label,
  as a 256 × 256 PNG and declared registry release artwork.
- No plugin runtime or permission changes. Profile and release listing checks passed.

## 0.0.1 — published 2026-11-04

- First release published under the verified emquix.com publisher identity.
- Editorial SEO/readability guidance, saved/unsaved draft analysis and search
  appearance previews using native EmDash SEO fields.
- Separate one-click saves for keyphrases, cornerstone, additional robots flags,
  social overrides and validated schema configuration, with stale-form protection.
- Automatic bounded site audits, duplicate metadata findings, internal-link
  guidance, paginated results/history and page-preserving filtering/sorting.
- Reviewed plugin-owned bulk changes, conditional rollback, mapped Yoast/Rank Math
  fixture imports and native SEO previews; no unsupported native SEO writes.
- Reviewed exact-path redirects with validation and core 404-report guidance.
- Optional llms.txt generator with public text endpoint, preview/download and a
  documented host root route; disabled by default and no external AI calls.
- Packaged Linux Node/EmDash 1.4 production workflows and restart were verified
  on a development artifact. The final 0.0.1 package still needs release checks.
- Native metadata remains owned by EmDash. Windows standalone production and
  deployed Cloudflare are not verified supported targets; see
  [compatibility](docs/compatibility.md).

The development notes below preserve implementation history. Historical test
versions/checksums are not evidence that the final 0.0.1 artifact was tested.

## Development history — optional llms.txt (2026-11-03)

- Add administrator-controlled, disabled-by-default llms.txt generation with
  collection selection, public summary, preview and download.
- Read fresh published titles/URLs with bounded queries and output; exclude
  noindex, hidden, draft, noncanonical and unsafe/off-site content.
- Declare a public read-only raw text route. Add an optional Astro root-route
  example and disposable-site integration; no new capabilities or dependencies.
- Document manual robots.txt reference setup: EmDash has no sandbox hook for
  modifying core robots.txt, and `Llms:` is not a standard directive.
- Preserve the updated EmDash 1.4 editor saves, SEO settings and Windows config.

## Development history — local QA fixes and EmDash 1.4 (2026-11-03)

- Preserve omitted plugin settings in partial bulk updates; verify preview,
  multi-entry apply and conditional rollback with non-default existing values.
- Retain submitted admin forms on validation errors, with readable messages and
  correction without reload. Remount recovered field groups to avoid stale inputs.
- Omit unchanged empty schema fields from change reviews.
- Upgrade the tested Windows site to EmDash 1.4.0 and matching official tooling;
  verify the upstream nested-form fix. Native sandbox SEO writes remain blocked.
- Pin security patches and compatible transitive overrides; no automatic fixes.
- Add a local-only browser regression journey that changes no global settings,
  and a portable Python fixture-test launcher.
- Preserve local Windows configuration, SQLite content and historical audits.

## Development history — draft workflow and automatic audits (2026-10-26)

- Read the current entry’s saved draft revision with the new `content:revisions:read` capability; label fallback and current-editor sources honestly.
- Add **Analyze current editor** to the sidebar with full analysis, configured Portable Text fields and equivalent saved SEO/settings. Preserve scoring model 2.
- Schedule durable bounded audit batches, with retry backoff, leases, cancellation, restart recovery and explicit manual fallback.
- Improve dashboard hierarchy, paginated audit results/history, candidate pagination and internal-link empty states.
- Use contextual review headings, single-entry Apply/Revert labels, vertical sidebar metadata and collapsed technical details; remove redundant navigation.
- Use Zod 4.3.6 Mini from the existing dependency to keep the backend below EmDash’s 128 KB file cap; preserve strict validation rules.
- Add regression coverage and [workflow/manual-test documentation](docs/editor-and-audits.md). No public release or registry submission.

## Development history — URL resilience and scoring model 2 (2026-10-22)

- Load saved and unsaved content analysis without a configured Site URL; show
  actionable warnings and N/A URL checks instead of throwing or guessing routes.
- Reject malformed-base artifacts returned by EmDash; keep unrelated API errors.
- Replace vacuous scoring passes with an explicit editorial foundation and
  optional diagnostic deductions; make keyphrase placement unscored guidance.
- Distinguish saved descriptions from excerpt previews, expose partial coverage,
  separate sectioning from hierarchy, and clarify readability/language limits.
- Apply coverage rules to incremental audits; retain settings and change history.
- Add regression coverage for URL recovery, article shapes, neutral optional
  checks, metadata provenance, non-English content and real sandbox workflows.

## Initial development — 2026-10-21

- Independently implemented TypeScript editorial and English readability rules.
- Added Block Kit editor/settings, social metadata and validated schema graphs.
- Added incremental content audit, link suggestions and change journals.
- Added mapped WordPress metadata conversion and import previews.
- Added exact-path core redirect administration and export.
- Verified the official Worker Loader sandbox boundary and authorization.
- Blocked native SEO mutations after real integration tests exposed an EmDash
  1.3.1 bridge limitation. These fields remain preview-only in 0.0.1.

No registry release has been made during the recorded development work.

# Changelog

## Unreleased — draft workflow and automatic audits (2026-10-26)

- Read the current entry’s saved draft revision with the new `content:revisions:read` capability; label fallback and current-editor sources honestly.
- Add **Analyze current editor** to the sidebar with full analysis, configured Portable Text fields and equivalent saved SEO/settings. Preserve scoring model 2.
- Schedule durable bounded audit batches, with retry backoff, leases, cancellation, restart recovery and explicit manual fallback.
- Improve dashboard hierarchy, paginated audit results/history, candidate pagination and internal-link empty states.
- Use contextual review headings, single-entry Apply/Revert labels, vertical sidebar metadata and collapsed technical details; remove redundant navigation.
- Use Zod 4.3.6 Mini from the existing dependency to keep the backend below EmDash’s 128 KB file cap; preserve strict validation rules.
- Add regression coverage and [workflow/manual-test documentation](docs/editor-and-audits.md). No public release or registry submission.

## Unreleased — URL resilience and scoring model 2 (2026-10-22)

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

## 0.1.0-alpha.1 — unreleased

- Independently implemented TypeScript editorial and English readability rules.
- Added Block Kit editor/settings, social metadata and validated schema graphs.
- Added incremental content audit, link suggestions and change journals.
- Added mapped WordPress metadata conversion and import previews.
- Added exact-path core redirect administration and export.
- Verified the official Worker Loader sandbox boundary and authorization.
- Blocked native SEO mutations after real integration tests exposed an EmDash
  1.3.1 bridge limitation. This is a release blocker, not a completed feature.

No 1.0 release has been made.

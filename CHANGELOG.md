# Changelog

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

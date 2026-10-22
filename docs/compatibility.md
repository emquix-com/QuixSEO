# Compatibility and platform limitations

## Release-blocking native SEO write gap

EmDash 1.3.1 exposes `seo` in its native content update contract, but both actual
sandbox bridge implementations send the update data to `updateDraftAware`
without the native context's SEO handling. The official production sandbox test
returned `Unknown field 'seo' in collection 'posts'`. This was reproduced during
implementation, not inferred only from documentation.

Evidence: installed `emdash/src/plugins/context.ts` (native handling),
`@emdash-cms/cloudflare` bridge `contentUpdate`, and
`@emdash-cms/sandbox-workerd` bridge-handler `contentUpdate`. See
research/sources.json for the research snapshot.

QuixSEO requests **no content write permission** and refuses an entire plan
containing native SEO differences before writing plugin data. Native title,
description, canonical, social image and noindex edits are preview-only in
QuixSEO. Use core's SEO editor. Plugin-owned changes work with CAS and conditional
rollback. Even once the bridge is fixed, core needs conditional SEO writes:
SEO-only updates do not change the content version, so version checks alone
cannot prevent concurrent overwrites.

## EmDash 1.3.1 admin UI constraints

- Saved-entry plugin panels are currently mounted in the editor sidebar. The public plugin manifest's `editorPanels` contract has no placement option for an under-editor full-width panel. QuixSEO cannot relocate itself beneath the body editor without upstream EmDash support. A separate full-page SEO workspace may be developed using official admin-page routes.
- Block Kit table badges have no semantic color property and currently render with a neutral background. QuixSEO uses compact **Passed / Review / Fix / N/A** labels with colored circle indicators. A fully colored background like the native `Published` badge would require upstream badge variant support.
- The sandbox editor-panel API also exposes no plugin-controlled full-content modal or alternate editor placement. Confirmation dialogs are limited to button confirmation; a dedicated full-page plugin workspace is the supported larger-screen alternative.
- The change-review UI displays field-by-field before and after values rather than raw JSON; schema and FAQ fields are rendered as readable text. This is presentation only: confirmation, native SEO write refusal, conflict detection and rollback remain server-enforced.

## Other boundaries

- `<title>` is rendered by the theme, outside `page:metadata`. Canonical and native
  metadata remain core-owned. QuixSEO contributes structured metadata, with
  core deduplication and a `primary` schema graph.
- The sandbox has no 404 event/log API. Use core's true original-path report.
- There is no remote crawling. Broken HTTP destinations, sitemap fetches,
  robots.txt fetches and redirect destination availability are unverified.
- Redirect UI checks bounded matching rules. The pure graph analyzer supports
  chains/loops, but full-site/pattern graph checks are not wired into the UI.
- Audits include published routable SEO-enabled content. Navigation, menu links,
  other rendering blocks and external inbound links are absent from the graph.
  Content can change during a scan; this is not a transactional site snapshot.
- Link suggestions inspect the first 100 audit records; extraction is bounded
  to 5,000 blocks / 200,000 characters. Audit edges use the first 100 unique
  internal targets per entry. Large content may have incomplete coverage.
- Language formulas support English only. Structural checks remain available
  elsewhere; multilingual schemas/locale routing depend on core.
- Bulk filters apply to the displayed page. Rich bulk editing and schema use
  JSON fields in this alpha; a polished field-mapping/form experience is pending.
- Registry identity is deliberately `quixseo.invalid`. CLI validation/build
  success does not establish registry publication eligibility.

No actual competitor plugin installation or deployed Cloudflare certification
is claimed. Turn metadata/schema output off in all but one SEO plugin. A second
emitter resolver test is useful, but does not certify arbitrary plugins/themes.

## workerd URL normalization

Real Node/workerd public rendering exposed legacy `URL.hash = ""` behavior that
retained an empty fragment. QuixSEO now strips fragments from serialized URLs
without the setter, and the production sandbox asserts valid schema IDs and
incoming links with fragment-bearing targets. Node-only unit tests would not
have caught this difference.

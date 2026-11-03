# QuixSEO editor integration — EmDash 1.4.0

QuixSEO is part of [EmQuix](https://emquix.com). The native SEO panel remains
EmDash's source of truth. QuixSEO removes its duplicate title, description,
canonical, social-image and noindex inputs, but still reads their saved values
for analysis, previews and published-content audits.

## Supported save workflow

Use **Save QuixSEO settings** once for focus phrases, cornerstone, nofollow,
nosnippet, Open Graph overrides, X/Twitter overrides and validated schema JSON.
The response refreshes the analysis and confirms success. Settings on published
entries take effect immediately. Native Save/autosave does not submit this form.
Validation and conflict failures preserve submitted text and boolean values for
correction/copying; on conflicts copy edits before refreshing. Unsaved panel
values are not persisted when navigating away or refreshing.

Storage remains `entries`, keyed by `collection:id`; no migration or clearing is
performed. Existing overrides and defaults are loaded into the form. A hash of
the displayed configuration rejects stale submissions before creating a journal;
existing compare-and-set revision checks protect the subsequent write. Native
SEO proposals are empty. No content update/publish API is invoked and no content
revision is created. Changes remain in plugin history with actor-bound,
conditional rollback. Older journals and native-change refusal remain supported.
Bulk/migration operations still require review and confirmation.

The November 3 Windows verification also tested the EmDash 1.4.0 upgrade. Its
Block Kit field groups remove the nested HTML form warnings seen on 1.3.1.
Separate native/plugin saves and native SEO bridge limitations remain. Error
responses remount the retained field group without changing its action or
conflict token, so stale submissions still cannot overwrite newer settings.

## Inspected upstream contracts

Reviewed the installed, locked EmDash 1.3.1 source and matching admin source map:

- `src/plugins/manifest-schema.ts`: editor panels/actions offer explicit draft
  read/patch selectors. They do not bind Block Kit form state to Save/autosave.
  Field widgets target native schema fields, not arbitrary plugin storage.
- `src/plugins/types.ts`: `ContentHookEvent` passes saved content and actor;
  `content:afterSave` has no unsent panel form values.
- Native schema fields could participate in native save/revisions, but would
  require site collection changes and migration from plugin storage. Draft patch
  is an explicit action on declared content fields, not panel autosave. This
  release keeps existing storage and permissions rather than adding that coupling.
- Admin `SeoFields.tsx` and `SeoImageField.tsx`: native title, description,
  canonical, noindex and image; no independent OG title/description or X override
  controls. The QuixSEO overrides therefore remain useful and are labeled as such.
- Block Kit `LinkTarget`: content, plugin page/settings and external destinations;
  no native SEO-tab target. No guessed deep link is supplied.
- `src/plugins/http-route-dispatch.ts` enforces content ownership before injecting
  editor context. The plugin also requires role 30 and the editor-panel surface.
- `src/page/seo-contributions.ts`, `metadata.ts` and `EmDashHead.astro`: native
  SEO overlays the page; plugin contributions precede base fallbacks and resolver
  keys deduplicate metadata/canonical/primary JSON-LD. Title is owned by the theme/head template, outside plugin contributions. Actual handler/resolver integration tests cover OG and X keys too.
  Themes that manually emit a second head remain outside this guarantee.

## Upstream feature-request draft (not submitted)

**Title:** Bind sandboxed editor settings to native Save/autosave

Provide a declarative plugin-owned settings binding for saved-entry panels,
including host-held dirty form state, an expected plugin-storage revision and a
sandbox validation handler. Native Save/autosave should submit this state with
the authenticated entry context, report validation/conflict errors without
losing input, and define atomicity/retry and revision restore semantics. Enforce
entry ownership and plugin storage scope. Do not expose DOM access or privileged
native SEO writes. Provide a supported native-panel navigation target separately.

Acceptance: stale tabs cannot overwrite newer settings; failed saves retain
input; autosave never publishes drafts; revision restoration has a documented
policy for plugin state; no panel JavaScript is required.

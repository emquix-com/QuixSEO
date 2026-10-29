# Editor drafts, automatic audits and review navigation

Target: EmDash 1.3.1, Node 24. No changes to EmDash core are required.

## Editor workflow

Open QuixSEO on a saved entry. The panel reads the current entry and, when its
`draftRevisionId` differs from `liveRevisionId`, requests that exact revision
through `ctx.content.getRevision(collection, entryId, draftRevisionId)`. It
checks all three identifiers on the result. It never enumerates arbitrary
revisions. The new `content:revisions:read` capability is needed for this read;
review/approve it when updating an installed plugin. Host edit/ownership checks
still apply. This adds no content-write or network permission.

The content API can return the live body while exposing a newer draft pointer.
That caused the old sidebar to miss headings saved without publishing. Revision
selection now happens before the shared analyzer receives the body and title.
The public metadata hook remains unchanged and never reads these draft bodies.

The source is always visible:

- **Published content**: the available published snapshot.
- **Saved draft — unpublished changes**: a saved unpublished revision.
- **Current editor — unsaved changes**: an explicit authorized editor snapshot.

Choose **Analyze current editor** inside the sidebar for unsaved content. Initial
`panel_load` has no unsaved values; this explicit Block Kit action receives the
host-attested snapshot and returns the full checklist in the sidebar. It does
not save or publish. **Refresh saved analysis** reloads stored content. The
older editor-menu action remains available as a short summary.

Both draft paths use saved native SEO metadata and QuixSEO entry settings. They
do not claim to read unsaved native SEO controls, changed slugs or public routes.
Draft route checks are unavailable, with coverage visible separately from the
score. Compare scores only with equivalent checks and metadata. Scoring model 2
and its weights have not changed. A missing/inaccessible saved revision produces
a visible fallback warning, names the snapshot actually used, and retains a
collapsed diagnostic for read errors. Other content API failures still surface.

The body comes from the first Portable Text field in the collection schema,
not a hardcoded `body`. Multiple independent Portable Text fields are not merged.
Posts and pages are declared for current-editor access. The manifest selector
includes translatable fields and explicit `title`, `excerpt`, `body`, `content`.
EmDash requires explicit collection names for draft-enabled extensions; it has
no schema-type wildcard. For another collection, add its slug to both editor
extension `collections` lists; for a nontranslatable field with a different name,
add it to their draft `fields` lists, rebuild and update the plugin. Audits still
discover configured custom collections automatically. A body omitted by a draft
selector is N/A, never silently replaced by its saved body.

## Automatic site reviews

Choose **Start a new site review** once. QuixSEO stores a durable job, schedules a
plugin-scoped recurring cron task and processes an initial bounded batch. The
`cron` hook continues scanning and then assessing without an open browser. Each
invocation starts at most 25 one-entry steps and stops starting steps after five
seconds. An individual entry remains subject to EmDash's invocation limits.
The schedule requests 15-second intervals; actual delivery follows the host's
scheduler cadence (Cloudflare deployments commonly tick once a minute).

- The job cursor, counters and phase commit together with revision-based CAS.
- A 60-second lease prevents overlapping workers; stale leases can be reclaimed.
- Scan snapshots are create-only. Replayed steps reuse the same snapshot and
  stable edge keys, preventing duplicate aggregate counts after interruption.
- Failures preserve committed progress and retry after 1, 2, 4, 8 and 16 minutes.
  Five consecutive failures stop the task in **Failed or interrupted** state;
  **Resume audit** resets the failure state after the underlying issue is fixed.
- **Cancel audit** supersedes an active worker's lease. That worker cannot commit
  counters over the cancellation. Partial snapshots are retained, not called
  completed. Start a new review when needed.
- Completed, cancelled and failed jobs remove their recurring task. A retry of
  an already completed job does not change its totals. Older scoring-model jobs
  cannot be resumed into mixed results; start a new review.

EmDash supplies plugin cron without an additional capability. Persistence alone
does not prove a host scheduler is running. Node deployments need the normal
EmDash Node scheduler; Cloudflare needs EmDash's scheduled handler and a Cron
Trigger. Use the official `emdash doctor` diagnostics for deployment wiring.
If scheduling fails, the UI offers **Resume audit**, processing one safe batch
per click. If a scheduled job reports no progress for three minutes, the UI
shows an interruption warning and the same recovery action. It cannot diagnose
a stopped server while that server is offline. Host task-claim recovery may also
delay execution after a crash (EmDash's stale running-task timeout is ten minutes).

**Refresh status** only reads progress; it never processes content. The phases
are **Scanning content**, **Assessing findings**, **Completed**, **Failed or
interrupted**, and **Cancelled**. Counts are actual scanned/assessed entries, not
an invented total or percentage. The site average appears only after both phases
finish and is labeled partial when any entry has unavailable checks. Scans are
not a transactional snapshot of a changing website; run another review after
large editorial changes. Audits always examine published content.

## Results and change history

**View audit results** opens **SEO audit results**, with visible article scores
and Fix / Review / unavailable counts before opening details. A single-result
audit shows findings directly, without a duplicate table or page filters. Results use pages of ten; the explicit
filter and ordering controls apply to that page, not the whole database. Older
snapshots remain under **Previous site reviews**. Findings use a table, with
entry identifiers under **Advanced details** and a contextual **Back to audit**.

**Internal link suggestions** evaluates 100 candidates per page and shows at most
five matches. **Search next 100 candidates** examines later pages; rankings are
local to each candidate page, not globally optimal. A one-eligible-article audit
explains that more relevant published pages are needed. Larger unmatched batches
say no sufficiently relevant candidates were found. **Back to audit results**
returns to the parent results. Potentially orphaned means no incoming links were
found in analyzed bodies; menus, navigation, external sites and content outside
the audit are excluded.

Single-entry review uses **Apply changes** and **Revert change**. Multi-entry
plans keep **Apply next entry** and **Revert next unchanged result**. Headings
change to **Change applied**, **Change reverted**, or **Change details** as
appropriate; the original before/after comparison stays as historical evidence.
Sidebar metadata is vertical. Full-width details use native columns; Block Kit
has no max-width control, so a fixed-width centered card cannot be promised.
Technical IDs are collapsed. Native plugin navigation replaces duplicate top
links. Permission checks, actor-bound approvals, preview conflicts and conditional
rollback remain unchanged. Badge labels remain Passed / Review / Fix / N/A.

## Suggested manual acceptance checks

1. Publish a five-paragraph post. Save an H2 without publishing, reload QuixSEO,
   and verify saved-draft source and heading feedback. Remove the H2, save again,
   and verify the feedback changes. Check the anonymous page stays unchanged.
2. Insert an H2 without saving. Choose Analyze current editor; inspect the full
   checklist and partial coverage. Refresh saved analysis to restore saved data.
3. Repeat with a translatable `article_text` Portable Text field on pages. For a
   custom collection, declare its selectors first. Omit a nontranslatable custom
   field from selectors and verify it is explicitly unavailable.
4. Save focus phrases, social overrides and schema with Save QuixSEO settings;
   refresh to verify persistence and revert the operation from change history. Change the same value separately and verify stale
   rollback refuses to overwrite it. Repeat with a multi-entry plan.
5. Start reviews on empty, one-entry and large sites. Close the browser. Restart
   the server during a larger review, return, and refresh status until complete.
   Counts should match eligible entries without duplication. Inspect older jobs.
6. Stop the scheduler, verify stale progress and Resume audit, then restore it.
   Cancel an active review and confirm subsequent refreshes remain Cancelled.
7. Open results, page/filter/order, inspect partial checks, try suggestions on a
   one-article site and across more than 100 candidates. Verify all Back actions.
8. Confirm native SEO tags and public social/schema output remain deduplicated.
   No production site or Windows `test-site/astro.config.mjs` changes are needed.

See [editor save integration](editor-save-integration.md) for the one-click save
workflow, data preservation, inspected APIs and upstream feature-request draft.

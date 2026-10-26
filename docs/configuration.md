# Configuration and editorial workflow

1. Enable SEO on each relevant EmDash content type and configure public routes.
2. In QuixSEO setup, choose Organization/Person and enter truthful public identity
   details. Empty identity fields do not produce invented publisher claims.
3. Choose fallback social image/description, title template, collections and
   readability language. Only `{title}`, `{site}`, `{separator}`, `{excerpt}`
   and `{slug}` are accepted template variables. Templates are previews; they
   are not injected into `<title>` on every request.
4. Enable metadata/schema output only for the plugin you want to own it. Turn
   QuixSEO metadata off when another plugin owns social/schema output; analysis
   still works. Core SEO remains authoritative.
5. Save an entry and open QuixSEO. The sidebar uses its saved unpublished revision
   when available and identifies the content source. Choose **Analyze current editor**
   to inspect unsaved fields in the full sidebar. See [editor and audit workflows](editor-and-audits.md)
   for collection/field selectors and partial coverage. Unsupported blocks are explicit.
6. Set phrases, cornerstone, additional nofollow/nosnippet, social overrides or
   schema. Preview the change, review before/after values, and confirm. Native media IDs and relative canonical paths are preserved. Native
   fields must remain unchanged in this form: edit those in EmDash's SEO panel.
7. Start an audit once from Overview. The host scheduler advances bounded scan
   and assessment batches. Use Refresh status to inspect progress, or Resume audit
   if scheduling is unavailable. Counts remain provisional until both phases finish.

Editors can use site tools; authors can use the panel on entries they may edit.
Only administrators save site settings, create redirects or prepare migrations.
Only the actor who created a change plan can confirm or revert it. The history
page supports restarting incomplete operations. Reversion stops on conflicts.

Bulk JSON changes support up to 20 entries, 48 KB input and a 96 KB persisted
preview limit; use smaller batches for rich schema. Example:

```json
[{"collection":"posts","id":"YOUR_SAVED_ID","config":{"cornerstone":true,"keyphrases":["garden care"]}}]
```

Confirmed QuixSEO social/schema changes are live configuration and can affect
an already-published page immediately; they are not staged with the body draft.

There is no automatic content publishing, link insertion, keyword stuffing target,
background crawler or periodic automatic creation of new audits. Existing audit snapshots do not
refresh when content changes; start a new audit for current results.

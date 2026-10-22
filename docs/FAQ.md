# FAQ

**Is it free?** Yes. There are no paid features, ads, account requirements or
artificial commercial limits. Batch limits protect sandbox resources.

**Is it ready for production?** No. This is an alpha with explicit platform and
product gaps. See the feature ledger and release checklist.

**Why can't I save a title here?** EmDash 1.3.1 sandbox bridges cannot update
native SEO. Use the core SEO panel; QuixSEO can still analyze and preview it.

**Does a green score guarantee rankings?** No. It is an editorial checklist.
Search engines also rewrite snippets. Schema does not guarantee rich results.

**Does it send my content to AI?** No. There is no AI or outbound-network module.

**Does it generate another sitemap?** No. Core owns sitemaps, hreflang, robots,
canonical tags and indexing settings. Configure these in EmDash.

**Can I use another SEO plugin?** Keep one metadata/schema owner. QuixSEO's
analysis works with its output disabled. Full competitor coexistence is not
certified for this alpha.

**Are drafts analyzed?** Saved drafts can be analyzed in the authorized panel.
The explicit posts/pages draft action uses a host-provided snapshot and does not
save it. Public metadata never enumerates or reads unpublished bodies.

**Can I undo imports?** Plugin-owned changes can be reverted by their original
actor if current values still match the journal. Native fields and redirects
are not covered by that journal. Back up before migration.

**Where are 404 reports?** In EmDash core Redirects. The sandbox lacks a visitor
404-log API; QuixSEO does not simulate one.

**Why does QuixSEO say “Site URL not configured”?** Open **EmDash → Settings**
and configure the site's absolute HTTP(S) URL. Content analysis still works;
URL-dependent checks show N/A. QuixSEO reads the host's current URL context on
each load and stores no fallback domain. If your EmDash development server still
supplies old settings, refresh its runtime; no database reset or plugin reinstall
is needed. Start a new audit to refresh existing reports.

**Why did scores change?** Scoring model 2 removes free points for absent images,
links and headings, gives useful sectioning/linking more weight, and identifies
excerpt fallbacks. Keyphrase guidance is now unscored to avoid exact-match and
repetition incentives. See [scoring](scoring.md) for the full calculation.

**Can a partial analysis show a high score?** Yes: it describes only the checks
that could run. Unavailable checks are not passes. Read the coverage statement
and N/A explanations before comparing results. Accuracy and topical depth always
need a person's judgment.

# Feature comparison and implementation ledger

Reference comparison is for the free editions inspected at the commits in
research/sources.json, not a promise of identical algorithms or paid features.
QuixSEO implementation status is updated after verification.

| Capability | Yoast Free | Rank Math Free | EmDash core / existing plugin | QuixSEO responsibility |
|---|---|---|---|---|
| Titles, descriptions, canonical | Yes | Yes | Core and plugin | Reuse native fields, templates and review |
| Social metadata/previews | Metadata; preview scope varies | Yes | Core and plugin metadata | Per-entry overrides and text previews |
| Focus keyphrases | One primary | Multiple | Absent in core | Multiple, deterministic checks |
| SEO feedback | Yes | Yes | Absent in core | Original actionable checklist |
| Readability | Extensive language rules | Some rules | Absent | Structure plus English-only linguistic rules |
| Cornerstone content | Yes | Pillar concept | Absent | Designation and linking priority |
| Related internal links | Paid suggestions | Basic suggestions | Absent | Local topic overlap |
| Schema graph | Automatic types/blocks | Configurable types | Core basic; plugin richer graph | Ten validated types, no fabricated claims |
| Sitemap and hreflang | Yes | Yes | Core provides both | Reuse; inspect content eligibility |
| Robots.txt | Yes | Yes | Core | Reuse core configuration |
| Redirect manager | Paid | Yes | Core; plugin fuzzy suggestions | Validation and bounded import/export |
| 404 monitoring | No full free manager | Yes | Core original-path log | Reuse core UI; no sandbox log API |
| Site audit | Limited | Yes | No editorial site audit | Resumable local audit |
| Bulk metadata | Yes | Yes | Per-entry core fields | Preview, conflict checks, history/rollback |
| SEO migration | Yes | Yes | Core WordPress field import | File mapping into native SEO and plugin data |
| Analytics integrations | Limited/integrations | Yes | Not required | Deferred; no account required |
| AI suggestions | Paid/service dependent | Service dependent | Not required | Deferred, optional future BYOK |
| Registry sandbox distribution | WordPress plugin | WordPress plugin | Existing competitor native | Official sandbox format and Block Kit |

## Verified alpha implementation ledger

| Module | Current behavior | Remaining work |
|---|---|---|
| Dashboard | Status/coverage, completed averages, audit history, paginated findings with page filters | Global severity sorting, prioritized site-wide action queue |
| Editor | Saved draft revision analysis; explicit current-editor full sidebar; source/coverage labels; plugin-config review/save/revert | Native SEO writes blocked; richer interactive preview |
| Readability | Structural checks and English-only formula/rules | Additional tested language packs |
| Search appearance | Core field reuse, social overrides, fallback image/description, template previews | Native title/description/template application blocked |
| Schema | Ten validated types, linked graph, original JSON controls | Accessible type-specific visual forms, broader properties |
| Audit | Automatic bounded cron batches, cancellation/recovery, duplicate/link graph evaluation | Full technical crawl, known-target broken links, sitemap/robots verification |
| Redirects / 404 | Core rules list/create; strict path validation; one-rule import/page export; core 404 guidance | Whole-site graph and pattern conflict checks, destination availability |
| Bulk | Page filtering, JSON previews, actor-bound CAS writes/history/revert for plugin data | Native writes blocked; field-based bulk UI and site-wide filtering |
| Linking | Incoming/outgoing counts, cornerstone, local relevance suggestions (100 candidates/page, paginated) | Global relevance ranking, custom blocks |
| Migration | Local WXR mapping, Yoast/Rank Math plugin-data imports; native previews; warnings/revert | Native writes blocked; global settings/schema and wider export support |
| AI | No dependency, no network requests | Optional BYOK later |

These are working alpha workflows, not full feature parity. The comparison above
shows the intended division of responsibility, not a claim that every item ships.
Read [test results](docs/TEST-RESULTS.md) and [roadmap](docs/ROADMAP.md) before use.

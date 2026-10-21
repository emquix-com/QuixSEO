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

Implementation has not yet been verified. See the final implementation ledger
and docs/TEST-RESULTS.md before deploying.

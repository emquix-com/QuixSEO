# Scoring investigation — 2026-10-22

Baseline: upstream `05390dc37916093000991e488c50f428b5c77c95`, EmDash 1.3.1.
This investigation and design were recorded before implementation. Reference
source revisions are recorded in `research/sources.json`; no reference code is
copied into QuixSEO.

## Existing rules and the reported result

The old weighted average gives Passed=1, Review=0.5, Fix=0; N/A is excluded.

| Rule | Weight | Failure |
|---|---:|---|
| Title present (including fallback title) | 3 | Fix |
| Description present (including unverified excerpt fallback) | 2 | Fix |
| Title at most 65 characters | 1 | Review |
| Description at most 170 characters | 1 | Review |
| Any readable body text | 2 | Fix |
| Logical heading hierarchy | 1 | Review |
| At least one internal link | 1 | Review |
| Informative images have alt text | 2 | Review |
| Safe link syntax | 2 | Fix |
| Each phrase in title, description, path, headings, introduction, body | 0.5 each | Review |
| External link count / no keyphrase | 0 | Informational / N/A |

With acceptable title/description lengths and nonempty body, no headings,
images or links, the only deduction is half of the internal-link weight:
`100 × 14.5 / 15 = 96.67`, rounded to **97**. The five-paragraph article gets
points for empty heading, image and link collections. Body presence says
nothing about whether an article fulfills its promise.

If the chosen phrase appears in all five non-heading locations, adding it
gives `100 × (14.5 + 2.75) / 18 = 95.83`, rounded to **96**. Thus the reported
result is consistent with the algorithm. The exact body, slug and saved SEO
description were not supplied, so this is an explanation of the reported
numbers, not a claim to have rerun that original article. Different phrase
placements yield different results.

Readability has six equal-weight English checks (paragraphs, sections,
sentences, repeated openings, transitions, Flesch estimate). Four passes and
two reviews give **83**. Without the actual text we cannot identify which two
failed. Non-English content previously had only the two structural checks.

## Root cause and platform evidence

`editor.ts` used `getPublicUrl() ?? new URL(guessedSlug, ctx.site.url)`.
EmDash 1.3.1's content access returns null for missing site URL or unpublished
content. The guessed fallback throws for an empty/malformed base; it can also
invent the wrong route. `classifyLinks`, keyphrase path checks and audit
canonical resolution make further unguarded URL constructions. Core's
`packages/core/src/plugins/content-access.ts` concatenates the configured site
URL and resolved route; callers must validate even non-null returned URLs.

Use one strict, non-throwing HTTP(S) parser and explicit nullable URL context.
Prefer EmDash's validated content URL. A valid site origin can classify
absolute/root-relative links, but cannot resolve page-relative targets or
prove a draft's public path. Never invent a slug route or fallback domain.
Do not catch content API/storage/permission failures as URL errors. Read
context on every load; do not persist URL configuration in plugin settings.

## Chosen scoring design

Keep the four badges, but distinguish N/A because a feature is absent from
N/A because evidence is unavailable. Display assessed/unavailable/not-applicable
counts and the specific gaps beside the score. A checklist never proves
topical depth, factual accuracy, rendered output or ranking potential.

Use a weighted editorial foundation: title 2, saved description 2, readable
body 4, useful sectioning 3, contextual internal linking 3. Passed=1,
Review=0.5, Fix=0. Exclude unavailable/inapplicable rules from both numerator
and denominator. Title fallback is identified; an excerpt preview is not
proof of a saved meta description. Unknown body blocks cannot pass checks
requiring full body visibility.

Sectioning becomes relevant for at least three nonempty prose paragraphs
(excluding list items). Hierarchy validity is a separate diagnostic. Missing
links are a review for multi-paragraph prose, not a universal quota for short
answers, utility pages or lists. A link is not automatically relevant: the
message asks the editor to judge usefulness. Two or fewer paragraphs do not
automatically need headings or links. Body-only headings/empty text need a
Fix; a single very short statement needs a review of whether it answers the
reader's question. There is no reward for adding words and no universal
minimum article length. Semantic depth is explicitly a human review, with
extra guidance for short multi-paragraph pieces rather than a fabricated
automated depth pass.

Optional diagnostics cannot inflate this foundation merely by existing or
passing. Actual detected problems deduct fixed points: title truncation
guideline 3, description truncation guideline 2, broken hierarchy 5, missing
informative alt text 5, unsafe/malformed links 10. Each diagnostic is charged
once regardless of count; N/A never deducts. These are editorial priorities,
not search-engine weights. The final score is clamped at zero; no applicable
foundation means no score. Safety checks stay useful even without a site URL.

Exact-match phrase checks are **unscored guidance**: synonyms can be correct,
and entering or repeating keywords must not manufacture quality points.
Missing images/external links are N/A, never positive scoring evidence.
No keyphrase enables no topic-placement checks and earns no points. Scores
can still be high for an excellent concise answer; coverage and human
judgment must remain visible. Removing evidence can change the applicable
denominator, so partial scores are not directly comparable to complete ones.

Readability remains independent. Remove vacuous passes for absent prose and
insufficient sentence samples. English heuristics apply only to English (or
explicit opt-in); unsupported languages show their limits. The small
transition-word vocabulary is advisory, not part of a readability grade.

## Comparison with established tools

Yoast's `seoAssessor`, `ValidOnlyResultsScoreAggregator` and
`SEOScoreAggregator` combine applicable scored assessments and offer separate
readability guidance. Its default text-length assessment recommends 300 words;
its assessor also checks image count, outbound links and keyword density.
QuixSEO adopts explicit applicability and actionable feedback, but not a
minimum length, image quota or density target.

Rank Math's open content-analyzer `ResultManager` normalizes earned points
against maximum points. `lengthContent` uses length bands from 600 to 2500
words; `linksHasInternal` has a default maximum of 5. Its modular diagnostics
are useful, but those length targets and exact-match incentives do not fit
this task. QuixSEO separates a small editorial foundation from optional
diagnostics so passing optional checks cannot dilute existing problems.

Both tools are references for usability and applicability, not calibration
standards or sources of MIT-licensed implementation code.

## Verification plan

Test URL absence/malformation/recovery in domain, editor, drafts and resumable
audits; preserve unrelated errors. Test distinct article shapes, missing
metadata provenance, non-English coverage and unsupported blocks. Check
monotonic improvements, neutral optional additions, and score math independent
of the reported sample. Run the full check/import/sandbox suites and real
browser workflows, retaining metadata, permission, conflict and rollback tests.

## Measured implementation results

The source before this change and model 2 were executed against the same
fixtures in `tests/fixtures/articles.ts` (2026-10-22). The checkout fixture is
an independently written **173-word reconstruction**, not the original article.

| Fixture | Old SEO | Model 2 SEO | Old readability | Model 2 readability |
|---|---:|---:|---:|---:|
| Checkout, saved description, no phrase | 97 | 79 | 92 | 90 |
| Same text, `woocommerce checkout` phrase | 96 | 79 | 92 | 90 |
| Same text, excerpt only | 97 | 71 | 92 | 90 |
| Three-paragraph gardening advice, no headings/links | 97 | 79 | 92 | 100 |
| Same gardening advice with a useful heading/internal link | 100 | 100 | 92 | 100 |
| Concise 22-word gardening answer, no required extras | 97 | 100 | 100 | 100 |
| Empty title, description and body | 50 | 0 | Not scored | Not scored |

For the checkout fixture the foundation earns
`2 + 2 + 4 + (3 × 0.5) + (3 × 0.5) = 11` of 14 weight units:
`round(100 × 11 / 14) = 79`. With an excerpt-only description it earns 10 of
14 units, or 71. No optional diagnostic deductions apply. Adding a phrase does
not change that result; it adds useful location-specific feedback.

The reconstructed prose's readability differs from the reported 83 because its
sentences are different. Removing the unscored transition vocabulary from the
denominator explains the gardening change. Neither comparison claims to
reproduce the original article's exact readability. The exact original body,
slug and saved metadata are still needed for a literal before/after result.

Real sandbox testing additionally exposed EmDash's single-trailing-slash
normalization: a setting of `https://` becomes `https:/`, and concatenating
`/posts/garden-care` produces `https://posts/garden-care`. Model 2 rejects this
malformed-base derivation; it does not treat `posts` as the website's host.

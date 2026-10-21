# Deterministic scoring

SEO and readability are separate. For each category: round
`100 × sum(weight × statusValue) / sum(applicable weights)`. Green is 1,
amber is 0.5, red is 0; unsupported and zero-weight rules are excluded. An empty
denominator displays “Not scored”. Site average uses analyzed SEO scores only.

| SEO rule | Weight | Failure |
|---|---:|---|
| Descriptive title present | 3 | Red |
| Description present | 2 | Red |
| Title ≤65 Unicode characters | 1 | Amber |
| Description ≤170 characters | 1 | Amber |
| Extractable body text present | 2 | Red |
| ≤1 body H1 and no skipped heading level | 1 | Amber |
| At least one relevant internal target | 1 | Amber |
| Informative images have alt text | 2 | Amber |
| Link URLs have valid safe syntax | 2 | Red |
| Each phrase in title, description, path, headings, introduction, body | 0.5 each | Amber |
| External link count | 0 | Informational |

Phrase matching uses normalized words, not substrings. There is no density
score or minimum word count. Exact wording is optional. Length checks estimate
truncation, not pixel width. Theme H1 and image rendering are outside body checks.

Every readability rule weighs 1 and returns green/amber. Paragraphs over 120
words or sections over 300 words suggest restructuring. English rules flag more
than 25% of sentences over 25 words, three consecutive sentences with identical
first two words, no recognized transition in passages of five or more sentences,
and estimated Flesch reading ease below 50. The transition vocabulary is a small
explicit list, not a claim of complete linguistic understanding.

Flesch estimate: `206.835 - 1.015 × words/sentences - 84.6 × syllables/words`.
Syllables use a documented heuristic in src/domain/analysis.ts; names,
abbreviations and specialist text may be misclassified. Automatic language mode
applies linguistic rules only to `en` locales; `structural` disables them and
`en` explicitly opts into them. Word segmentation is approximate in languages
without spaces. Editorial judgment takes precedence over any recommendation.

Audit missing/duplicate counts concern explicit core SEO overrides. A theme may
already provide a useful fallback. Potentially orphaned means no incoming body
links in this audit, not proof a search engine cannot discover the page.

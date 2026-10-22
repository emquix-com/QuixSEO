# Deterministic editorial scoring — model 2

The SEO score measures **available automated editorial checks**, not topical
expertise, factual accuracy, search intent satisfaction or Google rankings.
Readability is separate. A useful short answer can score highly; length alone
never earns points. See [the investigation](SCORING-AUDIT.md) for the previous
weights, reported 97/96 results and the Yoast/Rank Math comparison.

## Badges and coverage

- **Passed**: the stated condition was observed. Read its explanation: a link
  being present does not prove it is relevant or reachable.
- **Review**: a contextual recommendation or guideline, not a mandatory quota.
- **Fix**: a missing essential field/body or unsafe/malformed link.
- **N/A**: not applicable, or unavailable because the required evidence is
  missing. Each explanation distinguishes the two. Neither earns points.

The panel displays assessed, unavailable and not-applicable counts. Missing URL
context, unreadable custom blocks, unattested draft metadata, disabled readability
and unsupported language rules make assessment partial. These counts describe
implemented checks, not coverage of everything an SEO professional can evaluate.
Do not compare scores across different available checks or scoring versions.

## SEO calculation

The foundation is `100 × sum(weight × statusValue) / sum(applicable weights)`.
Passed=1, Review=0.5, Fix=0. N/A is excluded from **both** sums. Subtract detected
optional diagnostic deductions, round once and clamp at zero. No applicable
foundation means “Not scored”. Passing optional diagnostics never adds points or
increases the denominator, so adding a described image cannot dilute a problem.

| Foundation | Weight | Behavior |
|---|---:|---|
| Title | 2 | Fix if empty. A content-title fallback is explicitly identified. |
| Description | 2 | Passed for saved SEO text; Review for an excerpt fallback; Fix when absent; N/A for unattested draft SEO metadata. |
| Readable body | 4 | Fix for no prose (headings alone do not suffice); Review for a fragment below 20 words with fewer than two sentences; otherwise text presence only. Unknown blocks make this N/A. |
| Useful sectioning | 3 | For at least three nonempty prose paragraphs, Review without a nonempty H2–H6; otherwise Passed for heading presence. Concise passages/lists are N/A. |
| Contextual internal linking | 3 | For at least three prose paragraphs, Review with no internal targets, otherwise Passed for presence. Missing URL/structure evidence is N/A. Links in concise passages are unscored observations. |

Three prose paragraphs is a transparent scannability trigger, not a rule that
all paragraphs must discuss different topics. List items do not trigger it.
The fragment trigger prompts an editor to check completeness; it is not a
minimum article length. These heuristics cannot recognize every useful concise
format. Review the page's purpose before following a recommendation.

| Optional diagnostic | Deduction when an issue is detected |
|---|---:|
| Title exceeds 65 Unicode characters | 3 |
| Description/excerpt exceeds 170 characters | 2 |
| Empty heading, skipped heading level (including initial H3+), multiple body H1s | 5 |
| Informative image missing alt text | 5 |
| Malformed/unsafe link URL | 10 |

Each deduction applies once, regardless of item count. These are documented
editorial priorities, not claimed search-engine weights. Length estimates are
not pixel widths; the theme may append a site name. Theme H1s and rendered images
are outside body analysis. Explicitly decorative images need no description.
No images or links means N/A for their diagnostics, never an automatic pass.
External citations have no quota and are unscored.

Keyphrases are optional, **unscored** topic-placement guidance. Matching uses
normalized Unicode words in the title, description, introduction, body,
headings and public path. Missing headings have no heading-phrase test; absent
public paths are unavailable. Synonyms may be preferable. Adding phrases,
adding secondary phrases or repeating them cannot increase the SEO score.

Topical depth always needs human review. A short multi-paragraph piece (under
250 approximate words) receives a targeted prompt to check concrete advice,
examples and evidence. Longer content gets the same completeness reminder
without a “long enough” pass. Neither prompt changes the score.

## Metadata provenance and URLs

A saved native description and an excerpt used in a preview are distinct.
EmDash's `getSeoMeta()` can use the excerpt, but theme defaults can override it;
QuixSEO does not assert that a preview is the final rendered meta description.
Native metadata generation is unchanged. Audit missing/duplicate counts still
refer to explicit native overrides, as labeled in the dashboard.

QuixSEO accepts strict HTTP(S) URL evidence, including localhost for testing,
without fetching it. Credentials, malformed authorities, whitespace, backslashes
and non-HTTP schemes are rejected. Site bases with query/fragment are unusable.
A valid EmDash content URL is preferred. Known malformed-base concatenation
artifacts are rejected even if they resemble a valid absolute URL.

A valid site origin can classify absolute/root-relative links. Resolving
page-relative links and checking a phrase in the public path need the actual
content URL. Drafts do not get guessed slug routes. Missing or invalid URL
context produces N/A, a configuration warning, and partial analysis; text,
headings, alt text and supported readability checks continue. Unsafe link
schemes can still be detected without a base. No network requests are made and
safe syntax does not establish that a destination exists.

## Readability

The independent readability score is a weighted average with weight 1 for each
available scored rule: paragraph length, section length, English sentence
length, repeated sentence openings, and estimated English reading ease.
Passed=1, Review=0.5. A readable sample below 20 words is not graded; this is a
measurement limit, not a content-length requirement.

Paragraphs over 120 approximate words and sections over 300 suggest considering
breaks where ideas change. English sentence guidance flags more than 25% over
25 words. Repetition needs at least three sentences and checks three consecutive
identical two-word openings. Transition expressions are advisory and unscored;
passages below five sentences have no transition checklist. The small vocabulary
cannot grade logical coherence.

Flesch estimate: `206.835 - 1.015 × words/sentences - 84.6 × syllables/words`.
Scores below 50 prompt audience-sensitive review. Syllables are heuristic;
names, abbreviations and specialist terms can mislead it. Only prose feeds this
estimate, not headings. English rules apply to `en` locales in automatic mode;
`en` explicitly opts in, and `structural` disables linguistic rules.

Other space-separated languages retain structural length guidance and explicitly
mark English rules unavailable. Chinese, Japanese, Thai, Lao, Khmer and Burmese
word segmentation is not supported: word-based readability, fragment and
keyphrase rules are not applied. Approximate counts are not linguistic truth;
misdeclared locales and mixed-language text remain limitations.

## Audits and retained history

Each new audit records scoring model 2 and counts partial analyses. An unfinished
model-1 audit asks for a new analysis rather than mixing scoring systems. Existing
reports, settings and change history remain intact. Missing link evidence (or
truncation of the 100 indexed links per entry) suppresses incoming/orphan claims
for that audit. Even with complete inspected bodies, “potentially orphaned” means
no incoming body links in the selected audit, not no navigation or external links.
After fixing settings or editing content, start a new audit to refresh its snapshot.

# QuixSEO

**Complete SEO Toolkit for EmDash** · [EmQuix](https://emquix.com) · MIT

QuixSEO adds original editorial SEO guidance, readability checks, structured data,
and reviewed site management to EmDash. It is free, with no accounts, advertising,
paid features or AI dependency.

**Version: 0.0.2.** Available in the [EmDash registry](https://plugins.emdashcms.com/plugins/@emquix.com/quixseo).
The tested production target is **Linux, Node 24 and EmDash 1.4.0**, using the
official Node/workerd sandbox. A packaged 0.0.2 build passed production browser
workflows and restart checks. Fresh public-registry installation remains a
separate verification step. Windows development was tested; Windows
standalone production and deployed Cloudflare are not verified supported targets.
Cloudflare sandboxed plugins require Workers Paid.

Native SEO title, description, canonical URL, main social image and noindex
belong to EmDash's SEO panel. The tested sandbox bridges cannot write those
fields, so QuixSEO refuses native changes. Native bulk edits and migrations are
preview-only; plugin-owned settings support saving and conditional rollback.
See [compatibility](docs/compatibility.md) and [remaining work](docs/ROADMAP.md).

Implemented workflows include:

- Saved-entry SEO/readability analysis with multiple keyphrases, explicit unsaved
  draft checks on posts/pages, and textual search/social previews.
- Plugin-owned social overrides, robots additions, cornerstone flags and ten
  schema types, with one-click entry saves, conflict detection and conditional
  rollback. Bulk changes retain review and confirmation.
- Resumable published-content audits, duplicate metadata counts, incoming links,
  potential orphan detection and bounded related-content suggestions.
- Core redirect listing and reviewed exact-path creation; mapped Yoast/Rank Math
  metadata previews and plugin-owned imports with a local WXR converter.
- Optional [llms.txt generation](docs/llms-txt.md), with a public Markdown
  endpoint, preview/download and a root-route setup example. Referencing it from
  robots.txt requires manual configuration under current sandbox APIs.

All administration uses EmDash Block Kit. There is no custom React admin, remote
crawler, analytics tracker or external AI request. Scores describe a documented
checklist; they do not predict rankings or guarantee rich results.
Scoring model 2 shows partial coverage, keeps exact-match keyphrase advice
unscored, and works without a Site URL. Configure **EmDash → Settings** to enable
URL-related checks. See [scoring rules](docs/scoring.md) and the
[independent scoring audit](docs/SCORING-AUDIT.md).

See [editor drafts and automatic audit workflows](docs/editor-and-audits.md) for
current-editor analysis, scheduler setup, result navigation and manual checks.

## Try the development build

Use Node 24 and Python 3. The site is disposable and must not be deployed publicly
in development mode.

```sh
npm ci
npm run check
npm run test:imports
npm run test:sandbox
npm run dev:site -- --ignore-lock
```

Open the local URL printed by Astro, then
`/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`. Enable **SEO** for the
Posts/Pages content types. Open **QuixSEO → Setup & settings**, then an entry's
QuixSEO panel. See [installation](docs/installation.md) for the integration and
[configuration](docs/configuration.md) for actual supported controls.

## Documentation

- [Feature comparison and implementation ledger](FEATURES.md)
- [Architecture and verified APIs](ARCHITECTURE.md)
- [Scoring rules](docs/scoring.md) · [Schema configuration](docs/schema.md)
- [Migration](docs/migration.md) · [FAQ](docs/FAQ.md)
- [Developer guide and tests](docs/development.md) · [Test results](docs/TEST-RESULTS.md)
- [Release checklist](docs/release.md) · [Security](SECURITY.md)

`npm run bundle` prepares a local registry-format artifact. The publisher is pinned
to the verified `emquix.com` identity (`did:plc:6clqzka76ueshbureaecbrfj`).
Publisher identity and CLI authentication were verified on 2026-11-04. Complete
the [release checklist](docs/release.md) before registry submission. Bundling does
not publish a release. The source package's `private` flag prevents accidental
npm publication; it does not prevent making the GitHub repository public.

## Bundled dependency license

The sandbox bundle includes Zod 4.6.7 under the following license. This text is
included here because the official registry packager includes README.md.

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Original QuixSEO license

```text
MIT License

Copyright (c) 2026 Webtaculos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Editor workflow: [Save QuixSEO settings and EmDash limitations](docs/editor-save-integration.md).

# Installation and disposable site

The current tested target is EmDash 1.4.0. The repository pins the tested toolchain in
package-lock.json. Install with Node 24 and `npm ci`; run `npm run check`.
Python 3 is only needed for the optional local WXR converter and its tests.

The included test-site uses SQLite, local uploads, Node sessions and the official
workerd sandbox runner. `npm run dev:site -- --ignore-lock` starts it. The printed
local port may change if 4321 is busy. The dev-bypass URL in README creates a
local development administrator. Never expose this dev server publicly.

Content types must have the `seo` support enabled in EmDash. The built-in seed
may omit it. Configure a public URL pattern (for example `/posts/{slug}`) so
content can be included in local audits. Create or edit content, save it, then
open QuixSEO. Settings are available in the QuixSEO navigation group.

For another disposable Node site, build QuixSEO and import its generated
`dist/index.mjs` descriptor in the Astro configuration. Add it to EmDash's
`sandboxed` array and select `@emdash-cms/sandbox-workerd/sandbox`. When importing
directly from a source checkout, use an absolute path to `dist/plugin.mjs` for
the descriptor's entrypoint, as shown in test-site/astro.config.mjs. The
host must register the `emdashLoader()` live collection (see
`test-site/src/live.config.ts`), render `EmDashHead` with `createPublicPageContext` and use core
`getSeoMeta` for title/native SEO. QuixSEO cannot repair a theme that omits
these APIs.

Cloudflare uses the official Cloudflare sandbox runner and its Worker Loader
binding. Follow the installed EmDash deployment documentation for platform
bindings; the local official plugin-test harness exercises that boundary.
A deployed Cloudflare site has not been certified for this alpha.

Database, uploads, sessions and generated test results are ignored by git.
To reset the fixture, stop its server and remove only its local database and
uploads after deciding whether you need them. No production repository or
EmQuix website is involved.

When updating, approve the new `content:revisions:read` capability to enable
saved-draft analysis. No content-write or additional cron capability is required.
For automatic audits, ensure the host runs EmDash scheduled tasks (Node scheduler
or Cloudflare scheduled handler plus Cron Trigger). See [workflow setup](editor-and-audits.md).
Do not replace a locally customized Windows `test-site/astro.config.mjs`; keep
your existing platform-specific configuration.

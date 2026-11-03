# Development and verification

Use the lockfile and Node 24. Install with `npm ci`. Source is strict TypeScript;
Python 3 is used only by the local WXR converter. Run:

```sh
npm run check
npm run test:imports
npm run test:sandbox
npm run bundle
```

The official plugin-test harness builds the plugin and runs the production
Worker Loader boundary with real storage/content fixtures. It needs local
network/socket permission. Unit tests do not substitute for sandbox tests.
The performance test processes 10,000 generated documents through the pure
analyzer; it is not a production database or Cloudflare CPU benchmark.

`src/domain` contains independently testable content, scoring, schema, redirects
and migration rules. `src/services` adapts actual EmDash APIs for metadata,
storage and resumable operations. `src/ui` produces Block Kit JSON; `src/plugin.ts`
declares hooks and permission-protected routes. There are no browser credentials.

The disposable `test-site` exercises Node/workerd and native rendering. After
`npm run dev:site -- --ignore-lock`, use the dev-bypass URL locally, enable SEO
and routes, create representative published/draft content, use the panel and
settings, save and revert QuixSEO fields, and inspect public head tags. Browser
scripts and results, where run, are recorded in TEST-RESULTS.md. Rebuild the plugin
and restart the site after changing plugin source.

Do not introduce a native privileged fallback for blocked features. First verify
the installed bridge, host role checks and CLI-generated manifest. Keep new
permissions minimal. Tests should exercise malformed inputs, concurrent changes,
retry behavior and actual output, not mirror implementation line by line.

## Repeatable Chromium journey

With the disposable server running, run `npm run test:browser`. Install the
Playwright Chromium binary with `npx playwright install chromium`, or select an
existing executable using `CHROMIUM_PATH=/usr/bin/chromium`. Override a different
local server port with `QUIXSEO_TEST_URL`; the script refuses non-loopback hosts.
On Windows the script also detects the standard system Edge installation. It
creates a uniquely named QA entry, tests editor persistence, sparse bulk changes,
rollback, stale submissions, validation recovery, native write refusal, public
HTML and an automatic audit. It never changes global identity or collection
settings or reuses an existing article. SEO and routes must already be enabled.
Its own entry is unpublished and settings cleared in `finally`; the labeled draft
and audit/change journals remain for review. An active existing audit is left
untouched. Screenshots and results default to ignored `test-results/regressions/`;
set `QUIXSEO_QA_DIR` to choose a dedicated output directory. The old seeded-site
journey in `tests/browser/smoke.mjs` is not the default test command.

`npm run test:imports` uses the Python launcher on Windows and Python 3 elsewhere.
Dependencies pin patched Zod/Vitest and compatible Undici 7 / Sharp overrides;
run `npm audit` as well as the functional checks when updating the lockfile.

See [draft and audit design](editor-and-audits.md) for the cron lifecycle, selector
configuration and manual regression checklist. Unit tests inject storage failures,
expired leases and concurrent cancellation; official sandbox tests exercise real
revision reads and scheduled tasks, including host restart. `#validation` is a
local build alias for the existing Zod Mini entry; keep its tsconfig path and
package import aligned so the official CLI bundles it into the isolate.

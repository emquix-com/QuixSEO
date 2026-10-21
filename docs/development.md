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
It intentionally creates/updates the `quixseo-garden` fixture, enables SEO on
Posts, saves test identity, publishes the fixture using core's API, exercises
editor preview/apply/rollback, checks anonymous HTML and completes a real audit.
It saves real screenshots in `screenshots/` and an ignored result JSON in
test-results. Use only the disposable site.

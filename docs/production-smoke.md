# Linux production smoke test

This manually triggered GitHub Actions workflow checks the packaged QuixSEO
plugin on a disposable Linux Node host. It does not deploy a public website,
create Cloudflare resources, publish a registry package or require repository
secrets. It has a 20-minute job limit and uploads evidence for seven days.

## Run

1. In GitHub billing/Actions settings, confirm included Actions minutes remain and
   spending is blocked at your intended limit. This repository is private: hosted
   Linux jobs consume the account's allowance and are not unconditionally free.
2. Open **Actions → Linux production smoke → Run workflow**, select the release
   branch/commit, and run it. The workflow is manual to avoid repeated extra runs.
3. Check the job conclusion and download **linux-production-evidence**. A green
   validation workflow alone is not a passing production smoke run.

The job installs locked dependencies with npm ci, builds the registry-format
archive, installs Chromium, and runs npm run test:production. Artifact metadata,
production logs, browser results and screenshots are retained on failures too.
Do not upload the temporary database or authentication state.

## What it verifies

- Plugin code is extracted from the release tarball into a unique temporary host;
  the source plugin descriptor is not loaded. The host performs its own npm-ci
  install using the package manifest and lockfile copied from this checkout.
- Independent SQLite, uploads, sessions and a dynamically allocated loopback port.
- Disposable setup runs in development mode before the production build. Its
  native fixture session is reused for authenticated production browser requests.
  Both development bypass endpoints must reject requests in production. There is
  no custom production authentication bypass and no production login credentials.
- Production sandbox registration and native admin UI, editor saves, sparse bulk
  changes/rollback, stale forms, validation retention, native SEO write refusal,
  public metadata/escaping and automatically completed site audits.
- llms.txt settings, preview, anonymous root/API responses, HEAD, download,
  cache headers, disabling and unchanged robots.txt.
- Published fixture content and audit persistence after production restart.

The existing regression journey waits up to three minutes for audit completion;
its former 15-second wait was too short on a multi-page dataset. Child processes
are bounded by the workflow timeout. Only generated disposable fixture content is
modified. The temporary host and session file are removed at the end.

## Interpretation

A passing run establishes the tested Linux Node/EmDash/sandbox combination for
the exact commit and artifact checksum. It does not establish Cloudflare Workers
compatibility, production account creation/sign-in/recovery, external ingress/TLS,
cross-tenant isolation, real WordPress migration interoperability, large-scale
performance or an independent security review. Native sandbox SEO writes remain
preview-only, and the known Windows standalone failure is not fixed by this job.

No successful Linux production run is claimed until the actual job completes and
its browser evidence is checked. For local reproduction on a supported host:

```sh
npm ci
npm run bundle
npx playwright install --with-deps chromium
npm run test:production
```

Do not point this runner at an existing development or production installation;
it intentionally creates its own host rather than accepting a target URL.

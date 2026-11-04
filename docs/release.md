# Release checklist — 0.0.1

The first planned public version is **0.0.1**. Preparing an archive does not
publish it. No repository workflow publishes automatically.

## Verified preparation

- Publisher: emquix.com, pinned as `did:plc:6clqzka76ueshbureaecbrfj`.
  Public handle/DID resolution and the official CLI's matching authenticated
  session were verified on 2026-11-04. Recheck `emdash-plugin whoami` at publication.
- A release-archive installation passed the Linux Node 24 / EmDash 1.4.0
  [production smoke test](production-smoke.md): editor saves, conflict protection,
  bulk rollback, public SEO, llms.txt, automatic audits and restart persistence.
  See [test results](TEST-RESULTS.md) for the tested commit and artifact.
- Audit sorting now preserves page context, with local browser and official
  sandbox regression evidence. CI passed commit `7240f49`.

## Before publication

1. Keep package.json and the lockfile at 0.0.1. Review CHANGELOG.md, screenshots,
   public claims, dependency notices and the scope in compatibility.md.
2. Run `npm ci`, `npm run check`, `npm run test:imports`,
   `npm run test:sandbox` and `npm run bundle` on the final release commit.
3. Run the manual Linux production smoke workflow on that same final commit.
   Inspect its logs and browser artifacts; an earlier development-build pass is
   not evidence that the final 0.0.1 archive passed. Record the final checksum.
4. Confirm the limitations: native SEO changes are preview-only; Windows Node
   production fails on the tested runner; deployed Cloudflare is untested and
   requires Workers Paid for sandboxed plugins; actual source-plugin migration
   exports and fresh production authentication remain unverified.
5. Make the GitHub repository public at launch, as planned, so setup links,
   security information and the llms.txt route example are accessible. Keep
   databases, credentials, sessions and local QA files out of Git.
6. Verify registry admission under the pinned publisher. Offline validation and
   OAuth login do not establish registry acceptance. Obtain final user approval
   before the public registry submission/release.
7. After publication, verify registry discovery and install the published package
   into a disposable supported host. Record its version and identity, run a smoke
   check, and verify the update path before claiming registry upgrade coverage.

## Artifact and recovery

The official CLI packages backend.js, manifest.json, README.md and two real
screenshots within its 256 KB unpacked limit. README includes QuixSEO and Zod
license notices because the packager does not copy arbitrary license files.
The source package stays `private: true` to prevent accidental npm publication;
GitHub visibility is independent of that setting.

Before an existing site's plugin update, back up the host database and retain the
previous archive/configuration. If verification fails, disable metadata
contributions to avoid competing output and follow the host's tested restore
procedure. Do not reset the database or delete historical reports to recover.
Backup restoration and registry upgrades have not yet been independently tested.

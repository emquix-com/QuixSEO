# Installation — QuixSEO 0.0.2

## Tested platform

The tested production target is Linux, Node 24, EmDash 1.4.0, Astro 7.4.2 and
@emdash-cms/sandbox-workerd 0.9.6. A packaged 0.0.2 build passed production browser
and restart checks on commit `53f0df2`.
See [compatibility](compatibility.md) for platform and feature boundaries.

Windows development was tested. Windows standalone production failed to load
the sandbox on the tested runner. Deployed Cloudflare is untested, and its
Worker Loader requires Workers Paid; Cloudflare Free cannot run this package.

## Registry installation

Version 0.0.2 is publicly listed. Locate QuixSEO under the verified
emquix.com publisher in EmDash's plugin registry. Review the requested access,
including the public read-only llms.txt route, before installation. Do not infer
registry availability from a successful local bundle. A clean registry install
and update must be verified as part of publication.

## Local archive installation

Run `npm ci` and `npm run bundle` in the source checkout to produce
`dist/quixseo-0.0.2.tar.gz`. Verify the recorded checksum, inspect the archive,
and extract it into the host's plugin directory. It contains backend.js and
manifest.json, not an entire EmDash site or a database.

For a manually configured Astro host, translate the archive manifest into the
config descriptor and register the backend using an absolute filesystem path:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const manifest = JSON.parse(readFileSync(new URL('./plugins/quixseo/manifest.json', import.meta.url), 'utf8'));
const quixseo = {
  ...manifest,
  adminPages: manifest.admin?.pages,
  editorPanels: manifest.admin?.editorPanels,
  editorActions: manifest.admin?.editorActions,
  format: 'standard',
  entrypoint: fileURLToPath(new URL('./plugins/quixseo/backend.js', import.meta.url)),
};
// Inside the host's existing emdash(...) configuration:
// sandboxed: [quixseo],
// sandboxRunner: '@emdash-cms/sandbox-workerd/sandbox',
```

Preserve the host's existing plugins, database, media, sessions and platform
configuration. The host must register the emdashLoader live collection, render
EmDashHead with createPublicPageContext and use core getSeoMeta for native SEO.
Pass the configured public site origin to the theme's SEO helpers rather than
an adapter-internal request origin. QuixSEO cannot repair a theme that omits
these APIs. Restart/build the host normally and check its actual plugin admin
page; HTTP 200 from the home page alone does not prove sandbox readiness.

Enable SEO and routability on relevant collections and set EmDash's Site URL.
Open QuixSEO → Setup & settings and an entry's QuixSEO panel. Native title,
description, canonical, social image and noindex remain in EmDash's SEO controls.
Choose **Save QuixSEO settings** to save plugin-owned fields separately from
the ordinary editor Save. See [configuration](configuration.md).

Automatic audits require EmDash scheduled tasks on the host. Serving the optional
guide at /llms.txt requires the [documented root route](llms-txt.md); installing
the plugin alone does not mount that path or change robots.txt.

## Disposable source-checkout site

Use Node 24 and `npm ci`. Python 3 is needed only for the WXR converter/tests.
Run `npm run dev:site -- --ignore-lock` and use the printed loopback URL. The
development setup endpoint in README creates a local fixture administrator;
never expose the development server or enable this mechanism in production.

Database, uploads and sessions persist locally. Do not replace a customized
Windows test-site/astro.config.mjs, reset a database or delete content to update
the plugin. For isolated verification, use the [production smoke test](production-smoke.md).

# Optional llms.txt guide

In **QuixSEO → Setup & settings → llms.txt**, enable **Enable public llms.txt
generation**, optionally enter a public site summary and collection slugs, then
choose **Save llms.txt settings**. A valid EmDash Site URL is required. Only an
administrator can configure or preview this feature. It is disabled by default.

**Preview llms.txt** uses saved settings and works even while public generation
is disabled. Once enabled, **Open generated file** and **Download llms.txt**
provide a plain-text Markdown document, not a JSON API wrapper.

`llms.txt` is a proposed convention for describing useful public resources to
tools that support it. Adoption varies. It is not a ranking factor, a guarantee
of AI visibility, a training license, or a replacement for robots.txt, sitemaps
or access controls. QuixSEO makes no external AI requests.

## Serve it at /llms.txt

EmDash 1.4 sandbox routes are mounted under `/_emdash/api/plugins/`. The plugin
can generate `/_emdash/api/plugins/quixseo/llms-txt`, but cannot independently
register a root `/llms.txt` route. Installing the plugin alone therefore does not
create `/llms.txt`.

For an Astro EmDash site, copy [the route example](../examples/llms.txt.ts) into
your site's `src/pages/llms.txt.ts`, then restart or deploy the site normally.
This uses Astro's internal `rewrite` to serve the sandbox response at `/llms.txt`;
it does not redirect visitors to the API, fetch another server, or bypass plugin
permissions. It requires server rendering, like the EmDash site itself. Match
your Astro base path and configured EmDash Site URL if the site uses a subpath.
The disposable test site already includes this route. No changes to
`astro.config.mjs` are necessary.

Verify `/llms.txt` returns status 200, `text/plain; charset=utf-8`, and the expected
public links. Disabling generation makes this live route return 404. An unusable
Site URL or generation failure returns 503, without leaking internal errors.
The response uses `Cache-Control: no-store` so QuixSEO does not keep a stale
public index. Avoid adding a CDN cache rule for this route.

Alternatively, download the file and place it in your site's public root using
your existing deployment process. A static copy must be regenerated and
redeployed manually after content changes. It **does not update or disappear**
when the plugin is disabled or content is unpublished/noindexed. Do not install
both a static file and the dynamic route at the same path.

## Reference it from robots.txt

EmDash 1.4 has no supported sandbox hook or core-settings-write capability for
editing robots.txt. QuixSEO deliberately leaves core rules unchanged. After
verifying the root route, append this informational comment in **EmDash →
Settings → SEO**, in the custom robots.txt field, using your actual public URL:

```text
# llms.txt: https://your-site.example/llms.txt
```

The plugin displays the comment with your configured URL. Preserve your existing
rules and sitemap handling. There is no standard `Llms:` robots directive; the
comment is for discovery by people/tools that choose to read it and does not
grant crawler access. Core normally disallows `/_emdash/`, which is another
reason to use the root route rather than advertise the plugin API URL. If you
later disable or remove the root route, remove the comment manually as well.

## What is included

- Site name, your optional public summary, and grouped page-title links.
- Only published entries from visible, routable, SEO-enabled collections. Empty
  collection selection means all eligible collections; otherwise it is an
  explicit comma-separated allowlist.
- No body text, excerpts, draft revisions or stored audit snapshots. Current
  published titles are used even when an entry has a newer unpublished revision.
- No noindex entries, alternate/invalid canonical URLs, duplicate URLs,
  off-site URLs, query/preview URLs, or EmDash admin/API paths. URLs must be inside
  the configured Site URL's origin and base path.

Each generation examines at most **50 published entries across 20 collections**,
in collection-slug order and newest creation date within each collection. Skipped
entries count toward that scan budget. Output is capped at **48,000 UTF-8 bytes**,
ending on a complete link. The preview reports checked/included/excluded counts
and warns when a limit is reached. Large sites receive a selected guide, not a
complete index or a claim that the most important pages were identified. Choose
collections deliberately. Selection is not yet manually curated per entry.

Reads are fresh on each request, bounded and sequential; nothing scans the site
on ordinary page rendering. Empty/malformed pagination fails safely. A concurrent
publish/unpublish during a request is not an atomic site snapshot. Default-locale
content is selected; a complete multilingual alternate-URL index is not provided.
The file does not evaluate arbitrary theme-level access restrictions, custom
robots.txt rules or authentication gates on otherwise published collections:
include only collections intended to be public. Hidden collections are excluded.

Settings are stored separately under the plugin's `settings/llms` key. Existing
SEO settings, entry overrides, change history and metadata generation are
untouched. No additional capabilities or network permissions are requested.
The manifest now declares a public, read-only route; normal EmDash installation
or update review may ask you to approve that public route surface.

## Manual checks

1. With the feature disabled, open the generated API and root URLs: both return
   404 (the root route must have been installed).
2. Enable it, enter a summary, save, preview, open and download. Confirm the file
   has correct public URLs and readable escaped titles.
3. Save an unpublished title change to a published entry: the file must retain
   the published title. Publish it, then confirm the new title appears.
4. Noindex or unpublish an included entry: it disappears on the next request.
5. Disable generation: both live URLs return 404. Check that existing native SEO
   settings and robots.txt are unchanged. Remove any manually deployed static
   copy/comment if applicable.
6. Try an invalid Site URL and a non-admin account: enabling is refused with a
   useful error; existing editorial analysis still works.

Automated coverage: `tests/unit/llms.test.ts`, `tests/sandbox/llms.test.ts`, and
the local browser journey `tests/browser/llms.mjs`.

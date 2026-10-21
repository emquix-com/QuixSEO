# Security

This alpha has no production support guarantee. Do not put sensitive customer
content in the disposable test fixture. Use GitHub private vulnerability
reporting if enabled on this repository; otherwise contact Webtaculos privately
through https://webtaculos.com. Do not disclose credentials in public issues.

QuixSEO requests content/schema read, explicit editor-draft read and redirect
write capabilities. It makes no network requests and has no secret storage or
AI module. User-provided URLs are data, never fetch targets. Public rendering
reads at most site settings and the current entry's plugin configuration.

Host permissions plus application role checks protect routes. Editor identity
comes from the host, not a submitted collection/id. Plugin data changes require
actor-bound previews and revision compare-and-set; rollback checks current
values before restoring. Native SEO mutations are blocked. Redirect creation
uses host authorization, strict paths and duplicate checks; simultaneous
administrator redirect creation is not a transaction spanning the reads/write.

Change history and audit reports contain site content/metadata and persist in
plugin-scoped storage. Limit access to editors/admins. There is no automatic
retention cleanup yet. WXR conversion is local, rejects DTD/entity declarations,
limits input size and never runs PHP. Run only on trusted local export files.

Remaining release security work includes independent review, deployed resource
budget checks, retention/erasure UX and full two-plugin compatibility testing.

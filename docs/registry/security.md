## Permissions and data

QuixSEO runs in EmDash's plugin sandbox. It requests content and revision reads, schema reads, explicit current-editor draft reads, and redirect read/write access for its documented features.

It does not request outbound network access and makes no external AI calls. Entry settings, audit reports and change history are stored in plugin-scoped storage on your site. Reports may contain content and metadata; restrict administrator/editor access appropriately. Automatic retention cleanup is not available yet.

The optional public llms.txt endpoint reads eligible published content and excludes drafts and noindex entries according to the documented rules. Enable it only when you want that public output.

Plugin-owned changes use validation and conflict checks; supported rollback checks current values before restoring them. Native SEO writes are blocked on the tested bridge. Redirects are not covered by the change-history rollback journal.

## Report a vulnerability

Follow the repository's security policy. Use private vulnerability reporting where available and never post credentials, private exports or sensitive site data in public issues.

[Security policy and reporting](https://github.com/emquix-com/QuixSEO/security)

QuixSEO is MIT-licensed and supplied without warranty. Independent security certification and full compatibility testing with other plugins have not been completed.

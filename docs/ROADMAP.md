# Prioritized remaining work

## 0.0.1 publication

- Finalize the release commit and changelog, run checks/bundle and the Linux
  production smoke workflow on it, and record the artifact checksum.
- Make documentation accessible at launch and complete registry admission,
  publication and a clean installation under the verified EmQuix DID.
- Keep supported platforms and preview-only native SEO operations explicit.
  See [release checklist](release.md) and [compatibility](compatibility.md).

Publisher verification, automatic bounded audits, editor conflict protection,
Linux production runtime/restart checks and the audit-page sorting fix are
implemented and tested. They are not future feature requests.

## Compatibility and verification priorities

- Resolve the upstream Windows sandbox executable-path failure and verify
  Windows production before adding it to the supported scope.
- Test deployed Cloudflare on Workers Paid; local Worker Loader tests do not
  certify deployed limits or Cloudflare Free compatibility.
- Expand production authentication, keyboard/mobile, representative themes and
  actual competing-plugin coverage. Perform an independent security review.
- Expand runtime/database benchmarks beyond the small production smoke dataset,
  local 38-entry audit and pure analyzer performance tests.
- Verify real Yoast/Rank Math exports; current conversion/import evidence uses
  labeled fixtures, not a complete real-world interoperability claim.

## Product improvements

- Native SEO bulk/migration application requires upstream sandbox support and
  atomic conditional writes. Until verified, keep those operations preview-only
  and preserve refusal of mixed plans without partial writes.
- Add field-based bulk/migration mapping and type-specific schema forms alongside
  the JSON controls. Preserve explicit confirmation and conflict checks.
- Add retention/cleanup controls and broaden stored-job recovery tests.
- Extend link-graph coverage, global candidate ranking, known-target broken-link
  checks and sitemap/robots consistency checks.
- Extend redirect pattern/global chain inspection, batch import/export and
  journaled rollback where core permits.
- Add locale-specific defaults, language rule packs, custom rich-block extractors
  and broader migration mappings.

## Optional enhancements

- BYOK AI only with supported secret storage, explicit sharing consent, cost
  estimates and review-only suggestions. Keep core features usable without AI.
- Analytics integrations only through supported sandbox APIs. No paid feature gates.

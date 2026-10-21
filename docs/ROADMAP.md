# Prioritized remaining work

## P0 — release blockers

- Upstream sandbox native SEO update support plus atomic conditional writes;
  then enable native editor/bulk/migration apply and test concurrent core edits.
- Expand the passing local browser journey to full keyboard/mobile coverage
  and certify deployed Cloudflare resource limits. Expand large database audit benchmarks beyond the
  existing 10,000-document pure analyzer test.
- Implement a usable field-based bulk/migration mapper and schema forms. JSON
  controls are functional but do not satisfy the intended finished product UX.
- Independent authorization, data-integrity and security review; automated
  retention/cleanup and failure recovery for persistent job history.
- Full test with the actual competing SEO plugin and representative themes.
- Verify registry publisher ownership and packaging under that identity.

## P1 — complete site management

- Durable automatic audit stepping/progress with supported scheduling, severity
  filters and prioritized cross-site actions. Never scan every page on render.
- Complete paginated internal-link graph and suggestions across all content,
  known-target broken-link checks, sitemap/robots consistency and schema coverage.
- Full redirect chain/loop graph and pattern conflict handling with conflict-safe
  imports, resumable batch export and journaled rollback where core permits.
- Locale-specific metadata defaults, custom rich-block extractors and additional
  language rule packs with native-language tests.
- Wider migration support for global settings, safe decoded schema and verified
  source export formats; preserve explicit mappings and incompatibility warnings.

## P2 — optional enhancements

- BYOK AI with supported secret storage, explicit content-sharing consent,
  cost estimates and review-only suggestions. Keep every core workflow usable
  without AI or an account.
- Optional analytics integrations and richer previews, only through real
  sandbox-supported APIs. No paid feature gates.

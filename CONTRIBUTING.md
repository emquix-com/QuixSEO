# Contributing

Read ARCHITECTURE.md and docs/compatibility.md before changing integration code.
Use Node 24, `npm ci`, `npm run check`, `npm run test:imports`, and
`npm run test:sandbox`. See docs/development.md for browser verification.

Use strict TypeScript and independently authored code. Do not copy GPL source,
reference UI assets, or undocumented platform hooks. Keep domain logic pure;
validate all user input at the boundary. New storage mutations need explicit
roles, reviewable previews and meaningful conflict/rollback tests. Keep audit
work bounded and public metadata rendering free of content scans.

Describe actual behavior and test evidence in changes. Do not replace an
unsupported feature with a success toast. Update the feature ledger, limits,
and tests when behavior changes. Submissions are under the MIT license.

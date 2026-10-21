# Release preparation

The current version is **0.1.0-alpha.1**. Neither 1.0.0 nor publication is ready.

`npm run validate`, `npm run build` and `npm run bundle` use official EmDash
plugin tooling. Inspect the generated descriptor, manifest and sandbox bundle.
The official tarball includes README.md, backend.js, manifest.json and two real
screenshots, within the 256 KB unpacked limit. README includes both original and
Zod license notices because the packager does not copy arbitrary license files.
The source package stays private to prevent accidental npm publication.

Before publication:

1. Resolve the sandbox native-SEO and concurrency blockers; implement and verify
   missing acceptance criteria in ROADMAP.md. Do not simply change the version.
2. Run automated, Node/workerd browser and deployed Cloudflare checks, large
   dataset budgets, independent security review and actual competitor coexistence.
3. Verify all user-facing claims, screenshots, migration mappings and licensing.
4. Confirm Webtaculos's verified Atmosphere publisher identity. Replace reserved
   `quixseo.invalid` with that exact verified identity and rebuild. GitHub ownership
   does not establish registry ownership.
5. Prepare a reviewed changelog, artifact checksums and rollback instructions.
6. Obtain explicit user approval before a public release or registry submission.

No workflow in this repository publishes, releases or submits to the registry.
Offline manifest validation is necessary but not sufficient for admission.

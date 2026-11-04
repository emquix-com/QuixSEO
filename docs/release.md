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
4. Authenticate the official CLI as `emquix.com` and verify its active session is
   `did:plc:6clqzka76ueshbureaecbrfj`, the publisher pinned in the manifest.
   Public handle resolution and the DID document were verified on 2026-11-04.
   The official CLI login and active publisher session were also verified on
   2026-11-04 with that exact DID. This does not publish a package or establish
   registry admission.
   The official CLI login and active publisher session were also verified on
   2026-11-04 with that exact DID. This does not publish a package or establish
   registry admission.
   GitHub ownership does not establish registry ownership; public identity
   resolution alone does not establish an authenticated publishing session.
5. Prepare a reviewed changelog, artifact checksums and rollback instructions.
6. Obtain explicit user approval before a public release or registry submission.

No workflow in this repository publishes, releases or submits to the registry.
Offline manifest validation is necessary but not sufficient for admission.

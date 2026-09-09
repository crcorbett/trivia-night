# Repository tooling

Bun owns installation/workspaces/catalogs, Turbo owns task ordering, TypeScript
owns project boundaries, Oxlint/Oxfmt own static style, Vitest owns tests, and
Knip maintains development and production graphs. The version snapshot is
refreshed provisionally and adopted only after clean compatibility gates.
Repository-specific Oxlint policy lives in `tools/oxlint`. Its workspace rule
resolves relative imports and requires explicit exports whenever code crosses
an `apps/*` or `packages/*` boundary. The configured rule set is the union of
the reviewed rule sources from Commonplace and `Projects/site`; same-named
anti-slop rules use the Site implementation, while Commonplace-only rules are
loaded under `common-effect`, `common-bun`, and `package`. `tools/oxlint/rules.test.ts`
checks that every exported rule is enabled. Effect TSGO is patched into Oxlint
by the root `prepare` script after installation.

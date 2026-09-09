# Oxlint rule sources

This directory contains the rule sources used by Trivia Night. The source
copies were reviewed from:

- `/Users/cooper/Projects/site/tools/oxlint/` at commit `107f4d6f3ff77a5d462f8ce0a2ae2f596c3a6c86`.
- `/Users/cooper/Projects/commonplace-plugins/tools/oxlint/` at commit `d3badeccec848bae3cf1ca6867346d7bc5cb765a`.

The source worktrees had unrelated uncommitted changes when they were read, so
the files in this repository are deliberate local snapshots rather than Git
submodules. Same-named anti-slop rules use the Site implementation; all
Commonplace-only Effect, Bun, and package-boundary rules remain enabled under
the `common-effect`, `common-bun`, and `package` plugin names. The separate
plugin names prevent the two repositories' `effect` and `bun` namespaces from
colliding.

`rules.test.ts` walks the loaded Oxlint configuration and checks every rule
exported by each local plugin. If a copied rule is not enabled, the test fails.
The rule implementation files are ignored by the repository lint run because
they are lint machinery with parser-facing AST values; they are loaded and
covered by the configuration test instead.

The Effect TSGO preset is also enabled. The `prepare` script runs
`effect-tsgo patch --oxlint` after install so the type-aware rules work on a
fresh machine and in CI.

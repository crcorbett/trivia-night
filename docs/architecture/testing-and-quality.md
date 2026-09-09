# Testing and quality

`bun run verification` is the owner of the ordered gate: governance validation,
format check, Oxlint, policy fixtures, infrastructure/workspace TypeScript,
development and production Knip graphs, tests, then build. Domain tests use
deterministic observable Layers. RPC/HTTP transport tests prove serialization.
Publishable packages require separate profile-owned source, declaration,
default, packed-artifact, and downstream consumer proof; the default gate does
not claim publisher behavior. The render receipt binds selected versions,
config and lockfile digests; these checks do not prove deployment or provider
state.

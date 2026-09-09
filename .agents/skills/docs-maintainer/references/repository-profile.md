# Repository documentation profile

## Current owners

- Docs router and lifecycle owner: `docs/README.md`
- Documentation registry: `docs/documentation-map.json`
- Architecture: `ARCHITECTURE.md` and `docs/architecture/`
- Standards: `docs/standards/`
- Active SPECs/tasks: `docs/product-specs/` and `docs/exec-plans/active/`
- Runbooks: `docs/runbooks/`
- Critical journeys: `docs/critical-journeys/journeys.json`
- Proof packets: `docs/proof/`
- Authority, automation, controls, epochs, and effectiveness: `docs/governance/`
- Repository harness profile: `docs/governance/harness-profile.json`
- Structured repository audits: `docs/audits/`
- Evidence, failed work, and archive route: `docs/evidence/`

## README and generated-reference rules

- Root README owns entry, setup, supported commands, and current navigation.
- App/package READMEs own their consumer entry points and exact public exports.
- READMEs summarize and route; they do not duplicate architecture or runbooks.
- Generators and lockfiles remain tool-owned. Record stable config/artifact
  digests in proof rather than copying generated or provider state into docs.
- Do not edit `node_modules`, `dist`, `.output`, `.turbo`, or generated
  `routeTree.gen.ts`.

## Exact checks

Run the applicable focused check first, then the relevant aggregate subset:

```bash
python3 tools/governance/validate.py .
python3 tools/governance/validate_audit_artifacts.py \
  --scope docs/audits/<audit>/audit-scope.json \
  --findings docs/audits/<audit>/audit-findings.json \
  --crosswalk docs/audits/<audit>/accepted-findings.json \
  --profile docs/governance/harness-profile.json
bun run format:check
bun run lint
bun run test:lint-rules
bun run check-types
bun run test
bun run build
bun run verification
```

The governance validators own the docs registry, harness profile, audit
artifacts, links, lifecycle, controls, journeys, proof shape, bounded receipts,
and local skill/reference integrity.
Product/runtime/provider claims additionally require their owning journey or
runbook receipt.

## Lifecycle, mirror, and authority

Lifecycle states are `current`, `superseded`, and `archived`. A superseded or
archived current-looking document requires a reason and successor/tombstone;
historical proof stays outside default navigation. Repository-local skills are
the portable source for this repository. `.claude/skills/**` contains only
validated links to `.agents/skills/**`; it is not a competing copy. Repository
writes do not authorize deploy, provider, release, publication, or push
operations.

# Repository skills

The baseline contains portable repository-local docs-maintainer,
package-structure, prd-writer, prd-review, prd-implementer, and
effect-client-wrapper skills. Repository docs
and commands own local truth. A separately installed global skill may provide
generic tooling, but local workflows never require its filesystem path.
Validate SKILL.md, references, and `agents/openai.yaml` whenever a skill changes.

The docs-maintainer repository profile names the docs router, semantic owners,
exact checks, README rules, generated/reference owners, runbooks, proof,
authority, archive, and mirror policy. The skill routes to those owners instead
of copying repository truth.

The shared harness invariant register, schemas, and audit method are contained
inside the local skills. `docs/governance/harness-profile.json` is the sole
repository-specific extension point. Whole-repository audits keep structured
scope, findings, and accepted-finding records under `docs/audits/`.

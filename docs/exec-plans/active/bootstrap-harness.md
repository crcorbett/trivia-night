---
status: active
owner: repository-maintainers
review_trigger: bootstrap completion, topology change, or harness-profile change
---

# Bootstrap and qualify the repository harness

This is the starting task for the rendered repository. It qualifies the local
60-minute trivia app without claiming provider or production behaviour.

## Tasks

- [x] Run `bun install` and retain the generated `bun.lock`.
- [ ] Run `python3 tools/governance/finalize_repository_receipt.py .` to bind
      `repo-structure.render.json` to the lockfile and formatted configuration.
- [x] Replace generic purpose, jobs, paths, commands, boundary facts,
      exclusions, and non-claims in
      `docs/governance/harness-profile.json` with repository truth.
- [x] Qualify each critical journey in
      `docs/critical-journeys/journeys.json`; add only real consumer or operator
      jobs with a false-green-resistant oracle.
- [x] Review the documentation map, runbook ownership, authority model,
      automation register, feedback controls, proof schemas, local skills, and
      compatibility links.
- [ ] Run focused package checks and `bun run verification` after the final
      dependency and reference update.
- [ ] Record the exact commit, commands, postconditions, limitations,
      non-claims, and rollback in `docs/proof/`.
- [ ] Change the harness profile lifecycle to the accepted repository phase and
      move this plan to `../completed/` only after all owners agree.

## Stop conditions

Stop rather than inventing current versions, provider state, credentials,
authority, deployment proof, publication proof, or qualified exceptions. The
Effect and Alchemy source references are committed as shallow submodules, and
Doppler is reserved for approved future provider commands rather than local
development secrets.

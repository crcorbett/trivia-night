# Documentation

This is the sole documentation router and lifecycle owner. Read only the row
needed for the current change, then follow its focused links.

| Need                                             | Semantic owner                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Stable system and package boundaries             | [`architecture/`](architecture/) and root [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Coding and quality rules                         | [`standards/`](standards/)                                                        |
| Product intent and acceptance                    | [`product-specs/`](product-specs/)                                                |
| Active implementation state                      | [`exec-plans/active/`](exec-plans/active/)                                        |
| Repeatable operations and rollback               | [`runbooks/`](runbooks/)                                                          |
| User-visible verification                        | [`critical-journeys/`](critical-journeys/)                                        |
| Claim-matched evidence                           | [`proof/`](proof/)                                                                |
| Authority, automation, controls, epochs, metrics | [`governance/`](governance/)                                                      |
| Structured repository audits                     | [`audits/`](audits/)                                                              |
| Evidence provenance and failed work              | [`evidence/`](evidence/)                                                          |
| Pinned upstream implementation source            | [`.references/`](../.references/)                                                 |
| Repository-local workflow routing                | [`skills.md`](skills.md)                                                          |

Lifecycle and ownership metadata are registered in
[`documentation-map.json`](documentation-map.json). Current documents are edited
with their owning code/config in the same slice. Superseded facts move to a
successor or evidence archive with provenance; completed task history does not
accumulate in `AGENTS.md` or this router. External systems remain authoritative
for live provider state and are read just in time through an approved runbook.

New repositories begin with
[`bootstrap-harness.md`](exec-plans/active/bootstrap-harness.md). Complete it
before treating the rendered profile, journeys, lockfile, or verification
claims as qualified repository truth.

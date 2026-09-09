# Repository audits

Whole-repository audits use the shared harness invariants and structured audit
artifacts. Reports are human-readable views; JSON records own scope, findings,
decisions, and accepted-finding handoff.

For a new audit:

1. copy `templates/audit-scope.template.json` and bind the exact repository
   revision, profile, jobs, corpus, authority, exclusions, and stop conditions;
2. copy `templates/audit-findings.template.json`, preserve stable IDs, and
   classify every fixed impact surface;
3. stop for user acceptance unless implementation was already authorized;
4. copy `templates/accepted-findings.template.json` and include accepted IDs
   only; and
5. validate the artifacts:

```bash
python3 tools/governance/validate_audit_artifacts.py \
  --scope docs/audits/<audit>/audit-scope.json \
  --findings docs/audits/<audit>/audit-findings.json \
  --crosswalk docs/audits/<audit>/accepted-findings.json \
  --profile docs/governance/harness-profile.json
```

Use `$prd-writer`, `$prd-review`, and `$prd-implementer` only after the finding
decision states are recorded. Retain optional, rejected, and deferred findings
outside implementation scope.

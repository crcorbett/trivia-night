# Runbooks

Runbooks own repeatable operational procedures; skills teach how to reason and
navigate. Add a runbook only for a real operation. Every runbook must state:

- preconditions and authoritative source;
- identity, capability, authority, approval boundary, duration, and revocation;
- exact target/environment and bounded steps;
- before/after evidence and postcondition receipt;
- rollback, recovery, escalation, limitations, and cleanup.

Live provider state is never copied here as durable truth. Read it just in time.
Use [`_template.md`](_template.md) and remove inapplicable sections explicitly.

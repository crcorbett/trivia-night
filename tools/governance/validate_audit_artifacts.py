#!/usr/bin/env python3
"""Validate repository harness audit artifacts without third-party packages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, NoReturn


SURFACES = {
    "docs",
    "readmes",
    "architecture_standards",
    "runbooks",
    "proof_evidence",
    "skills",
    "lint_config_ci",
    "spec_tasks",
    "tests_fixtures",
    "config_exports",
    "lifecycle",
    "release_rollback",
    "critical_journeys",
}
DECISIONS = {"proposed", "accepted", "rejected", "deferred", "optional"}
SURFACE_DECISIONS = {"change_required", "preserve", "not_applicable"}
FINDING_ID = re.compile(r"^FINDING-[0-9]{3}$")
INVARIANT_ID = re.compile(r"^HC-[A-Z]+-[0-9]{3}$")


def emit(status: str, invariant: str, target: str, recovery: str, postcondition: str) -> None:
    print(
        json.dumps(
            {
                "status": status,
                "invariant": invariant,
                "target": target,
                "recovery": recovery,
                "postcondition": postcondition,
                "nonClaims": [
                    "This validates artifact shape and cross-references only; it does not prove repository or provider behavior."
                ],
            },
            sort_keys=True,
        )
    )


def fail(invariant: str, target: str, recovery: str) -> NoReturn:
    emit("failed", invariant, target, recovery, "not established")
    raise SystemExit(1)


def load_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        fail("artifact is readable JSON", str(path), str(error))
    if not isinstance(value, dict):
        fail("artifact root is an object", str(path), "replace the root value with an object")
    return value


def non_empty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def non_empty_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(non_empty(item) for item in value)


def require_fields(value: dict[str, Any], fields: set[str], target: str) -> None:
    missing = fields - value.keys()
    if missing:
        fail("required artifact fields are present", target, f"add fields: {sorted(missing)}")


def validate_scope(scope: dict[str, Any], target: str) -> None:
    require_fields(
        scope,
        {
            "schemaVersion",
            "id",
            "profile",
            "target",
            "lifecyclePhase",
            "acceptedLocalDecisions",
            "claimedJobs",
            "representativeJourneyIds",
            "acceptedOutcomes",
            "proofBoundaries",
            "inventoryGroups",
            "deepReads",
            "authority",
            "exclusions",
            "stopConditions",
            "limitations",
            "nonClaims",
        },
        target,
    )
    if scope["schemaVersion"] != "1":
        fail("scope schema version is supported", target, "set schemaVersion to 1")
    for field in (
        "claimedJobs",
        "representativeJourneyIds",
        "acceptedOutcomes",
        "proofBoundaries",
        "exclusions",
        "stopConditions",
        "limitations",
        "nonClaims",
    ):
        if not non_empty_list(scope[field]):
            fail("scope list is explicit and non-empty", f"{target}:{field}", "add at least one concrete value")
    target_value = scope["target"]
    if not isinstance(target_value, dict) or not all(
        non_empty(target_value.get(field))
        for field in ("repository", "path", "revision", "worktreeState", "observedAt")
    ):
        fail("audit target identity is complete", f"{target}:target", "record repository, path, revision, worktree state, and observation time")
    authority = scope["authority"]
    if not isinstance(authority, dict) or authority.get("inspection") != "read_only":
        fail("audit inspection authority is read-only", f"{target}:authority", "record read_only inspection separately from mutation authority")
    if authority.get("externalAccess") == "mutation" and not non_empty(authority.get("approvalReceipt")):
        fail("external mutation has an approval receipt", f"{target}:authority", "attach the exact approval receipt or reduce access")
    inventory = scope["inventoryGroups"]
    if not isinstance(inventory, list) or not inventory:
        fail("corpus inventory is non-empty", f"{target}:inventoryGroups", "account for the required corpus groups")
    group_ids = [item.get("id") for item in inventory if isinstance(item, dict)]
    if len(group_ids) != len(inventory) or len(set(group_ids)) != len(group_ids):
        fail("corpus group IDs are complete and unique", f"{target}:inventoryGroups", "give every group one unique ID")


def validate_findings(findings: dict[str, Any], scope: dict[str, Any], target: str) -> dict[str, str]:
    require_fields(
        findings,
        {
            "schemaVersion",
            "auditId",
            "targetRevision",
            "findings",
            "foundationsToPreserve",
            "limitations",
            "nonClaims",
        },
        target,
    )
    if findings["schemaVersion"] != "1":
        fail("findings schema version is supported", target, "set schemaVersion to 1")
    if findings["auditId"] != scope["id"]:
        fail("findings bind to the audit scope", target, "set auditId to the scope id")
    if findings["targetRevision"] != scope["target"]["revision"]:
        fail("findings bind to the audited revision", target, "set targetRevision to the scope target revision")
    entries = findings["findings"]
    if not isinstance(entries, list):
        fail("findings is an array", f"{target}:findings", "use an array")
    states: dict[str, str] = {}
    for index, finding in enumerate(entries):
        item_target = f"{target}:findings[{index}]"
        if not isinstance(finding, dict):
            fail("finding is an object", item_target, "replace it with an object")
        require_fields(
            finding,
            {
                "id",
                "invariantIds",
                "priority",
                "risk",
                "evidence",
                "lifecycleOrDecision",
                "semanticOwner",
                "proofGap",
                "rootCorrection",
                "retire",
                "surfaces",
                "verification",
                "journeyIds",
                "authorityOrDecision",
                "limitations",
                "nonClaims",
                "decision",
            },
            item_target,
        )
        finding_id = finding["id"]
        if not isinstance(finding_id, str) or not FINDING_ID.fullmatch(finding_id):
            fail("finding ID is stable", item_target, "use FINDING-NNN")
        if finding_id in states:
            fail("finding IDs are unique", finding_id, "merge the duplicate root cause or allocate a new ID")
        if finding["decision"] not in DECISIONS:
            fail("finding decision is valid", finding_id, f"use one of {sorted(DECISIONS)}")
        if finding["priority"] not in {"important_correction", "optional_improvement"}:
            fail("finding priority is valid", finding_id, "use important_correction or optional_improvement")
        if (
            not isinstance(finding["invariantIds"], list)
            or not finding["invariantIds"]
            or not all(isinstance(item, str) and INVARIANT_ID.fullmatch(item) for item in finding["invariantIds"])
        ):
            fail("finding cites harness invariant IDs", finding_id, "add one or more HC-AREA-NNN IDs")
        if not isinstance(finding["evidence"], list) or not finding["evidence"]:
            fail("finding has concrete evidence", finding_id, "add path or artifact observations")
        surfaces = finding["surfaces"]
        if not isinstance(surfaces, dict) or set(surfaces) != SURFACES:
            fail("finding classifies every fixed impact surface", finding_id, f"use exactly {sorted(SURFACES)}")
        for surface, decision in surfaces.items():
            if (
                not isinstance(decision, dict)
                or decision.get("decision") not in SURFACE_DECISIONS
                or not non_empty_list(decision.get("evidence"))
            ):
                fail("surface decision has a valid state and evidence", f"{finding_id}:{surface}", "record change_required, preserve, or not_applicable with evidence")
        for field in ("verification", "limitations", "nonClaims"):
            if not non_empty_list(finding[field]):
                fail("finding proof metadata is explicit", f"{finding_id}:{field}", "add at least one concrete value")
        states[finding_id] = finding["decision"]
    return states


def validate_crosswalk(crosswalk: dict[str, Any], scope: dict[str, Any], states: dict[str, str], target: str) -> None:
    require_fields(crosswalk, {"schemaVersion", "auditId", "targetRevision", "entries"}, target)
    if crosswalk["schemaVersion"] != "1" or crosswalk["auditId"] != scope["id"] or crosswalk["targetRevision"] != scope["target"]["revision"]:
        fail("accepted finding crosswalk binds to the audit and revision", target, "align schemaVersion, auditId, and targetRevision")
    entries = crosswalk["entries"]
    if not isinstance(entries, list):
        fail("crosswalk entries is an array", target, "use an entries array")
    observed: set[str] = set()
    for index, entry in enumerate(entries):
        item_target = f"{target}:entries[{index}]"
        if not isinstance(entry, dict):
            fail("crosswalk entry is an object", item_target, "replace it with an object")
        require_fields(entry, {"findingId", "requirementIds", "taskIds", "owningPaths", "verification", "proof"}, item_target)
        finding_id = entry["findingId"]
        if states.get(finding_id) != "accepted":
            fail("crosswalk includes accepted findings only", str(finding_id), "accept the finding or remove it from implementation scope")
        if finding_id in observed:
            fail("accepted finding appears once in the crosswalk", finding_id, "merge its requirement and task mappings")
        for field in ("requirementIds", "taskIds", "owningPaths", "verification", "proof"):
            if not non_empty_list(entry[field]):
                fail("crosswalk mapping is complete", f"{finding_id}:{field}", "add at least one concrete value")
        observed.add(finding_id)
    accepted = {finding_id for finding_id, state in states.items() if state == "accepted"}
    if observed != accepted:
        fail("every accepted finding is mapped exactly once", target, f"missing={sorted(accepted - observed)} unexpected={sorted(observed - accepted)}")


def validate_profile(profile: dict[str, Any], target: str) -> None:
    require_fields(
        profile,
        {
            "schemaVersion",
            "repository",
            "purpose",
            "lifecyclePhase",
            "identitySource",
            "owners",
            "commands",
            "representativeJobs",
            "criticalJourneyOwner",
            "boundaryFacts",
            "exclusions",
            "nonClaims",
            "exceptions",
        },
        target,
    )
    if profile["schemaVersion"] != "1":
        fail("repository profile schema version is supported", target, "set schemaVersion to 1")
    for field in ("repository", "purpose", "lifecyclePhase", "identitySource", "criticalJourneyOwner"):
        if not non_empty(profile[field]):
            fail("repository profile identity is explicit", f"{target}:{field}", "add a concrete value")
    owners = profile["owners"]
    owner_fields = {
        "docsRouter",
        "architecture",
        "standards",
        "readmes",
        "generatedReference",
        "runbooks",
        "proof",
        "evidence",
        "activeSpecs",
        "activePlans",
        "archives",
        "skills",
        "agentGuidance",
    }
    if not isinstance(owners, dict) or set(owners) != owner_fields:
        fail("repository profile declares every semantic owner class", target, f"use exactly {sorted(owner_fields)}")
    if not non_empty(owners["docsRouter"]) or not all(
        non_empty_list(owners[field]) for field in owner_fields - {"docsRouter"}
    ):
        fail("repository profile owner paths are explicit", target, "add the docs router and at least one path for every owner class")
    if not isinstance(profile["representativeJobs"], list) or not profile["representativeJobs"]:
        fail("repository profile declares representative jobs", target, "add at least one consumer-facing job")
    job_ids: set[str] = set()
    for job in profile["representativeJobs"]:
        if (
            not isinstance(job, dict)
            or set(job) != {"id", "consumer", "acceptedOutcome", "owningPaths"}
            or not all(non_empty(job.get(field)) for field in ("id", "consumer", "acceptedOutcome"))
            or not non_empty_list(job.get("owningPaths"))
        ):
            fail("representative job contract is complete", target, "record ID, consumer, accepted outcome, and owning paths")
        if job["id"] in job_ids:
            fail("representative job IDs are unique", job["id"], "merge the duplicate or allocate one stable ID")
        job_ids.add(job["id"])
    commands = profile["commands"]
    if not isinstance(commands, dict) or set(commands) != {"documentation", "skills", "focused", "closeout"}:
        fail("repository profile declares exact command classes", target, "declare documentation, skills, focused, and closeout commands")
    if not all(non_empty_list(value) for value in commands.values()):
        fail("repository profile commands are explicit", target, "replace empty command classes with repository-owned commands")
    for field in ("boundaryFacts", "exclusions", "nonClaims"):
        if not non_empty_list(profile[field]):
            fail("repository profile boundaries are explicit", f"{target}:{field}", "add at least one concrete value")
    for exception in profile["exceptions"]:
        if not isinstance(exception, dict) or not {
            "id",
            "invariantId",
            "replacement",
            "rationale",
            "owner",
            "evidence",
            "reviewTrigger",
            "retirementCondition",
        }.issubset(exception):
            fail("repository exception is fully qualified", target, "add replacement, evidence, owner, review, and retirement fields")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", type=Path)
    parser.add_argument("--findings", type=Path)
    parser.add_argument("--crosswalk", type=Path)
    parser.add_argument("--profile", type=Path)
    args = parser.parse_args()

    if bool(args.scope) != bool(args.findings):
        fail("scope and findings are supplied together", "arguments", "pass both --scope and --findings")
    if args.crosswalk and not args.scope:
        fail("crosswalk is validated with scope and findings", "arguments", "pass --scope and --findings")
    if not args.scope and not args.profile:
        fail("at least one harness artifact is selected", "arguments", "pass --profile or both --scope and --findings")

    audit_id = "repository-profile"
    if args.scope and args.findings:
        scope = load_object(args.scope)
        findings = load_object(args.findings)
        validate_scope(scope, str(args.scope))
        states = validate_findings(findings, scope, str(args.findings))
        audit_id = scope["id"]
        if args.crosswalk:
            validate_crosswalk(load_object(args.crosswalk), scope, states, str(args.crosswalk))
    if args.profile:
        validate_profile(load_object(args.profile), str(args.profile))
    emit(
        "passed",
        "audit scope, findings, decisions, and accepted-finding mappings are coherent",
        audit_id,
        "none",
        "structured audit artifacts validated",
    )


if __name__ == "__main__":
    main()

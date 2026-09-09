#!/usr/bin/env python3
"""Validate repository governance owners and bounded artifacts without dependencies."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path


def fail(invariant: str, target: str, recovery: str) -> None:
    print(json.dumps({"status":"failed","invariant":invariant,"target":target,"recovery":recovery,"details":None,"postcondition":"not established","nonClaims":["No repository verification claim was established."]}))
    raise SystemExit(1)


repository_skills = (
    "docs-maintainer",
    "effect-client-wrapper",
    "package-structure",
    "prd-implementer",
    "prd-review",
    "prd-writer",
)
generated_skill_overlays = {
    "docs-maintainer": ("references/repository-profile.md",),
    "package-structure": ("references/repository-profile.md",),
}


def skill_tree_receipt(skill_root: Path, excluded: tuple[str, ...]) -> dict[str, object]:
    entries: dict[str, dict[str, object]] = {}
    excluded_paths = set(excluded)
    for path in sorted(skill_root.rglob("*")):
        relative = path.relative_to(skill_root)
        key = relative.as_posix()
        if (
            key in excluded_paths
            or ".DS_Store" in relative.parts
            or "__pycache__" in relative.parts
            or path.suffix == ".pyc"
        ):
            continue
        if path.is_symlink():
            entries[key] = {"kind": "symlink", "target": os.readlink(path)}
        elif path.is_file():
            entries[key] = {
                "kind": "file",
                "mode": stat.S_IMODE(path.stat().st_mode),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        elif not path.is_dir():
            fail(
                "repository skill tree contains only files, directories, and links",
                str(path),
                "remove the unsupported filesystem entry and rerender",
            )
    encoded = json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()
    return {
        "entryCount": len(entries),
        "treeDigest": hashlib.sha256(encoded).hexdigest(),
    }


root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve(strict=True)
profile_path = root / "docs/governance/harness-profile.json"
profile_validator = root / "tools/governance/validate_audit_artifacts.py"
profile_result = subprocess.run(
    [
        "python3",
        str(profile_validator),
        "--profile",
        str(profile_path),
    ],
    text=True,
    capture_output=True,
    check=False,
)
if profile_result.returncode != 0:
    fail(
        "repository harness profile is structurally complete",
        str(profile_path),
        profile_result.stdout.strip() or profile_result.stderr.strip(),
    )
docs_map_path = root / "docs/documentation-map.json"
try:
    docs_map = json.loads(docs_map_path.read_text())
except (OSError, json.JSONDecodeError) as error:
    fail("documentation registry is readable JSON", str(docs_map_path), str(error))
owners = docs_map.get("owners")
if docs_map.get("router") != "docs/README.md" or not isinstance(owners, list):
    fail("one documentation router is declared", str(docs_map_path), "declare docs/README.md and an owners array")
semantic_keys: set[str] = set()
paths: set[str] = set()
for owner in owners:
    required = {"semanticKey","class","path","owner","status","reviewTriggers","retireWhen","replacedBy"}
    if not isinstance(owner, dict) or not required.issubset(owner):
        fail("documentation owner metadata is complete", str(docs_map_path), "add every lifecycle and retirement field")
    if owner["semanticKey"] in semantic_keys or owner["path"] in paths:
        fail("semantic owners and paths are unique", owner["semanticKey"], "retire the duplicate and route to one current owner")
    semantic_keys.add(owner["semanticKey"])
    paths.add(owner["path"])
    target = (root / owner["path"]).resolve()
    if root not in target.parents and target != root:
        fail("documentation paths remain inside the repository", owner["path"], "use a repository-relative path")
    if not target.is_file():
        fail("registered documentation owner exists", owner["path"], "restore the owner or record its successor")
    if owner["status"] == "current" and owner["replacedBy"] is not None:
        fail("current owner has no successor", owner["semanticKey"], "mark it superseded or clear replacedBy")
    if not owner["reviewTriggers"] or not owner["retireWhen"]:
        fail("owner has review and retirement metadata", owner["semanticKey"], "add concrete reviewTriggers and retireWhen")

for register_name in ("automation-register.json", "feedback-controls.json"):
    path = root / "docs/governance" / register_name
    register = json.loads(path.read_text())
    for entry in register.get("entries", []):
        for field in ("owner", "carryingCost", "reviewTrigger", "retireWhen"):
            if not entry.get(field):
                fail("control has maintenance and retirement metadata", f"{register_name}:{entry.get('id')}", f"add {field}")

journeys_path = root / "docs/critical-journeys/journeys.json"
journeys = json.loads(journeys_path.read_text()).get("journeys")
if not isinstance(journeys, list) or not journeys:
    fail("critical journey inventory is non-empty", str(journeys_path), "add a consumer-visible journey")
for journey in journeys:
    required_journey_fields = {
        "id",
        "actorOrConsumer",
        "boundary",
        "startingState",
        "inputs",
        "stepsOrProcedureOwner",
        "expectedBehavior",
        "expectedSideEffects",
        "preservedInvariants",
        "oracle",
        "environment",
        "authority",
        "evidence",
        "nonClaims",
    }
    if not isinstance(journey, dict) or set(journey) != required_journey_fields:
        fail(
            "critical journey uses the fixed field contract",
            journey.get("id", "unknown") if isinstance(journey, dict) else "unknown",
            "complete the actor, boundary, state, behavior, oracle, authority, evidence, and non-claim fields",
        )
    for field in (
        "inputs",
        "expectedBehavior",
        "expectedSideEffects",
        "preservedInvariants",
        "evidence",
        "nonClaims",
    ):
        if not isinstance(journey[field], list) or not journey[field]:
            fail(
                "critical journey list fields are explicit",
                f"{journey['id']}:{field}",
                "add at least one concrete value",
            )

receipt_path = root / "repo-structure.render.json"
receipt = json.loads(receipt_path.read_text())
if not receipt.get("officialSources") or not receipt.get("selectedVersions") or not receipt.get("compatibilityDecisions"):
    fail("render receipt has provenance and compatibility decisions", str(receipt_path), "rerender from a qualified snapshot")
if any(item.get("status") != "qualified" for item in receipt["compatibilityDecisions"]):
    fail("all selected compatibility decisions are qualified", str(receipt_path), "qualify or reject the provisional selection")
for relative, expected in receipt.get("configDigests", {}).items():
    target = root / relative
    observed = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
    if observed != expected:
        fail("rendered config digest matches", relative, "rerender or explicitly adopt the config change")
lockfile = receipt.get("lockfile", {})
if receipt.get("phase") == "bootstrapped":
    target = root / lockfile.get("path", "bun.lock")
    if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != lockfile.get("sha256"):
        fail("bootstrapped lockfile digest matches", str(target), "regenerate and finalize the receipt")
elif lockfile.get("status") != "not-generated" or lockfile.get("sha256") is not None:
    fail("rendered phase does not imply a lockfile", str(receipt_path), "record not-generated or finalize after bun install")
if not receipt.get("limitations") or not receipt.get("nonClaims"):
    fail("render receipt states limitations and non-claims", str(receipt_path), "add explicit limitations and nonClaims")

skill_baseline = receipt.get("skillBaseline")
if not isinstance(skill_baseline, dict):
    fail(
        "render receipt records the canonical skill baseline",
        str(receipt_path),
        "rerender from the canonical complete skill folders",
    )
recorded_skills = skill_baseline.get("skills")
if not isinstance(recorded_skills, dict) or set(recorded_skills) != set(repository_skills):
    fail(
        "render receipt names the exact repository skill set",
        str(receipt_path),
        "rerender with the current canonical repository skills",
    )
expected_overlays = sorted(
    f".agents/skills/{name}/{relative}"
    for name, paths in generated_skill_overlays.items()
    for relative in paths
)
if skill_baseline.get("generatedOverlays") != expected_overlays:
    fail(
        "only declared local skill profiles may differ from canonical skills",
        str(receipt_path),
        "restore the exact generated-overlay inventory and rerender",
    )
for name in repository_skills:
    skill_root = root / ".agents/skills" / name
    if not (skill_root / "SKILL.md").is_file() or not (skill_root / "agents/openai.yaml").is_file():
        fail(
            "repository skill is complete",
            name,
            "restore the complete canonical skill folder and rerender",
        )
    observed = skill_tree_receipt(skill_root, generated_skill_overlays.get(name, ()))
    if observed != recorded_skills[name]:
        fail(
            "repository skill matches its canonical render-time source",
            name,
            f"restore the canonical {name} tree; expected {recorded_skills[name]}, got {observed}",
        )
expected_links = {
    name: f"../../.agents/skills/{name}" for name in repository_skills
}
if skill_baseline.get("claudeLinks") != expected_links:
    fail(
        "render receipt records every standard Claude skill link",
        str(receipt_path),
        "rerender the complete Claude link inventory",
    )
for name, expected_target in expected_links.items():
    link = root / ".claude/skills" / name
    if (
        not link.is_symlink()
        or os.readlink(link) != expected_target
        or link.resolve() != (root / ".agents/skills" / name).resolve()
    ):
        fail(
            "Claude skill surface links to the repository-owned canonical copy",
            str(link),
            f"replace it with a symlink to {expected_target}",
        )

receipt_fields = {"schemaVersion","status","invariant","target","captureLimitBytes","capturedBytes","truncated","excerpt","details","recovery","postcondition","limitations","nonClaims"}
for bounded_path in (root / "docs").rglob("*.receipt.json"):
    bounded = json.loads(bounded_path.read_text())
    if not receipt_fields.issubset(bounded):
        fail("command receipt is bounded and complete", str(bounded_path), "add capture bounds, detail identity, recovery, postcondition, limitations, and nonClaims")
    if bounded["capturedBytes"] > bounded["captureLimitBytes"] or len(bounded["excerpt"].encode()) > bounded["captureLimitBytes"]:
        fail("command receipt respects capture limit", str(bounded_path), "truncate the excerpt and retain full detail by path/digest")
    details = bounded.get("details")
    if not isinstance(details, dict) or set(details) != {"path", "sha256"}:
        fail("command receipt identifies omitted detail", str(bounded_path), "record detail path and sha256, using null only when no detail exists")
    if not bounded["nonClaims"]:
        fail("command receipt states non-claims", str(bounded_path), "add at least one explicit non-claim")

link_pattern = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
for markdown in (root / "docs").rglob("*.md"):
    for raw in link_pattern.findall(markdown.read_text()):
        if raw.startswith(("http://", "https://", "#")):
            continue
        relative = raw.split("#", 1)[0]
        if not relative:
            continue
        target = (markdown.parent / relative).resolve()
        if (root not in target.parents and target != root) or not target.exists():
            fail("local documentation link resolves", f"{markdown.relative_to(root)} -> {raw}", "repair or retire the link")

print(json.dumps({"status":"passed","invariant":"repository governance owners and receipts are coherent","target":str(root),"recovery":"none","details":None,"postcondition":"owners, links, journeys, controls, and render receipt validated","nonClaims":["This does not prove installed dependencies, build output, or provider state."]}))

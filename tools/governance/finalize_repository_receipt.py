#!/usr/bin/env python3
"""Bind a rendered repository receipt to its generated Bun lockfile."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


parser = argparse.ArgumentParser()
parser.add_argument("repository")
args = parser.parse_args()
root = Path(args.repository).resolve(strict=True)
receipt_path = root / "repo-structure.render.json"
lockfile = root / "bun.lock"
if not receipt_path.is_file() or not lockfile.is_file():
    raise SystemExit("receipt and bun.lock must exist")
receipt = json.loads(receipt_path.read_text())
for relative, expected in receipt.get("configDigests", {}).items():
    path = root / relative
    if not path.is_file() or sha256(path) != expected:
        raise SystemExit(f"rendered config drift: {relative}")
formatter = root / "node_modules/.bin/oxfmt"
if not formatter.is_file():
    raise SystemExit("installed local oxfmt is required before receipt finalization")
subprocess.run([str(formatter), "--write", "."], cwd=root, check=True)
receipt["configDigests"] = {
    relative: sha256(root / relative)
    for relative in receipt.get("configDigests", {})
}
for package_receipt_path in (root / "packages").glob("*/package-structure.render.json"):
    package_receipt = json.loads(package_receipt_path.read_text())
    package_root = package_receipt_path.parent
    package_receipt["configDigests"] = {
        relative: sha256(package_root / relative)
        for relative in package_receipt.get("configDigests", {})
    }
    package_receipt_path.write_text(json.dumps(package_receipt, indent=2) + "\n")
    subprocess.run([str(formatter), "--write", str(package_receipt_path)], cwd=root, check=True)
receipt["phase"] = "bootstrapped"
receipt["lockfile"] = {
    "path": "bun.lock",
    "sha256": sha256(lockfile),
    "status": "generated",
    "owner": "bun install",
}
receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
subprocess.run([str(formatter), "--write", str(receipt_path)], cwd=root, check=True)
print(json.dumps({"status":"passed","target":str(root),"receipt":str(receipt_path),"lockfileSha256":receipt["lockfile"]["sha256"]}))

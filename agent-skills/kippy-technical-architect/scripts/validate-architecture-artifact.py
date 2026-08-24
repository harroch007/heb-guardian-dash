#!/usr/bin/env python3
"""Validate structural completeness of Kippy architecture Markdown artifacts."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


SCHEMAS: dict[str, list[tuple[str, tuple[str, ...]]]] = {
    "audit": [
        ("snapshot", ("snapshot",)),
        ("scope", ("scope",)),
        ("current architecture", ("current architecture",)),
        ("evidence", ("evidence",)),
        ("capability matrix", ("capability matrix",)),
        ("source conflicts", ("source conflicts", "conflicts")),
        ("findings", ("findings",)),
        ("risks", ("risks",)),
        ("recommendation", ("recommendation",)),
        ("phased roadmap", ("phased roadmap", "roadmap")),
        ("unknowns", ("unknowns",)),
        ("next safe action", ("next safe action",)),
    ],
    "adr": [
        ("status", ("status",)),
        ("date and owner", ("date and owner", "owner and date")),
        ("context", ("context",)),
        ("decision drivers", ("decision drivers", "drivers")),
        ("constraints", ("constraints",)),
        ("options considered", ("options considered", "alternatives considered", "options")),
        ("decision", ("decision",)),
        ("consequences", ("consequences",)),
        ("trade-offs", ("trade offs", "trade-off", "trade-offs")),
        ("ai, security, and privacy impact", ("ai security and privacy impact", "security and privacy impact")),
        ("migration", ("migration",)),
        ("rollback", ("rollback",)),
        ("validation", ("validation",)),
        ("evidence", ("evidence",)),
        ("supersession", ("supersession",)),
    ],
    "roadmap": [
        ("objective", ("objective",)),
        ("baseline", ("baseline",)),
        ("dependencies", ("dependencies",)),
        ("contracts", ("contracts",)),
        ("phases", ("phases",)),
        ("exit criteria", ("exit criteria",)),
        ("runtime validation", ("runtime validation",)),
        ("rollback", ("rollback",)),
        ("risks", ("risks",)),
        ("evidence", ("evidence",)),
        ("unknowns", ("unknowns",)),
        ("next safe action", ("next safe action",)),
    ],
    "agent-plan": [
        ("objective", ("objective",)),
        ("capability snapshot", ("capability snapshot",)),
        ("baseline", ("baseline",)),
        ("dependencies", ("dependencies",)),
        ("contracts", ("contracts",)),
        ("work lanes", ("work lanes", "lanes")),
        ("ownership", ("ownership",)),
        ("integration order", ("integration order",)),
        ("exit criteria", ("exit criteria",)),
        ("runtime validation", ("runtime validation",)),
        ("rollback", ("rollback",)),
        ("stop conditions", ("stop conditions",)),
        ("risks", ("risks",)),
        ("evidence", ("evidence",)),
        ("next safe action", ("next safe action",)),
    ],
}

DELIVERY_STATES = (
    "DESIGNED",
    "IMPLEMENTED",
    "COMMITTED",
    "PUSHED",
    "DEPLOYED",
    "RUNTIME_VALIDATED",
)

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
FENCE_OPEN_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
PLACEHOLDER_RE = re.compile(r"<[^>]+>|\bTODO\b|\[TODO[^\]]*\]", re.IGNORECASE)
EVIDENCE_MARKER_RE = re.compile(
    r"(?:\bEvidence\s*:|\bVerified at\s*:|https?://|(?:^|[\s`])[^\s`]+:\d+(?:[\s`]|$)|\bUNKNOWN\b)",
    re.IGNORECASE | re.MULTILINE,
)


@dataclass(frozen=True)
class Heading:
    level: int
    title: str
    normalized: str
    body_start: int
    section_end: int


def normalize_heading(value: str) -> str:
    value = value.casefold().replace("&", " and ")
    value = re.sub(r"[`*_]", "", value)
    value = re.sub(r"[^a-z0-9\u0590-\u05ff]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_input_text(text: str) -> str:
    """Remove a leading Unicode BOM before Markdown structure is parsed."""
    return text.removeprefix("\ufeff")


def mask_fenced_code(text: str) -> str:
    """Mask fenced code without changing offsets used to slice source sections."""
    output: list[str] = []
    fence_character: str | None = None
    fence_length = 0

    for line in text.splitlines(keepends=True):
        content = line.rstrip("\r\n")
        if fence_character is None:
            opening = FENCE_OPEN_RE.match(content)
            if opening is None:
                output.append(line)
                continue
            marker = opening.group(1)
            fence_character = marker[0]
            fence_length = len(marker)
        else:
            indentation = len(content) - len(content.lstrip(" "))
            if indentation <= 3:
                candidate = content[indentation:]
                if re.fullmatch(
                    rf"{re.escape(fence_character)}{{{fence_length},}}[ \t]*",
                    candidate,
                ):
                    fence_character = None
                    fence_length = 0

        output.append("".join(character if character in "\r\n" else " " for character in line))

    return "".join(output)


def parse_headings(text: str) -> list[Heading]:
    matches = list(HEADING_RE.finditer(mask_fenced_code(text)))
    headings: list[Heading] = []
    for index, match in enumerate(matches):
        level = len(match.group(1))
        end = len(text)
        for candidate in matches[index + 1 :]:
            if len(candidate.group(1)) <= level:
                end = candidate.start()
                break
        headings.append(
            Heading(
                level=level,
                title=match.group(2).strip(),
                normalized=normalize_heading(match.group(2)),
                body_start=match.end(),
                section_end=end,
            )
        )
    return headings


def infer_type(path: str, headings: Iterable[Heading]) -> str | None:
    lowered_path = path.casefold()
    titles = " ".join(item.normalized for item in headings)
    if "agent" in lowered_path and "plan" in lowered_path or "agent execution plan" in titles:
        return "agent-plan"
    if "roadmap" in lowered_path or "technical roadmap" in titles:
        return "roadmap"
    if "adr" in lowered_path or re.search(r"\badr\b", titles):
        return "adr"
    if "audit" in lowered_path or "architecture audit" in titles:
        return "audit"
    return None


def find_heading(headings: Iterable[Heading], aliases: tuple[str, ...]) -> Heading | None:
    normalized_aliases = {normalize_heading(alias) for alias in aliases}
    for heading in headings:
        if heading.normalized in normalized_aliases:
            return heading
    return None


def validate_text(text: str, artifact_type: str, source: str) -> dict[str, object]:
    text = normalize_input_text(text)
    errors: list[str] = []
    warnings: list[str] = []
    headings = parse_headings(text)

    if not text.strip():
        errors.append("Artifact is empty.")
    if not headings:
        errors.append("Artifact has no Markdown headings.")
    if PLACEHOLDER_RE.search(text):
        errors.append("Artifact contains unresolved placeholders or TODO markers.")

    schema = SCHEMAS[artifact_type]
    resolved: dict[str, Heading] = {}
    for label, aliases in schema:
        heading = find_heading(headings, aliases)
        if heading is None:
            errors.append(f"Missing required section: {label}.")
            continue
        resolved[label] = heading
        body = text[heading.body_start : heading.section_end].strip()
        if not body:
            errors.append(f"Required section is empty: {label}.")

    evidence_heading = resolved.get("evidence")
    if evidence_heading is not None:
        evidence_body = text[evidence_heading.body_start : evidence_heading.section_end].strip()
        if evidence_body and not EVIDENCE_MARKER_RE.search(evidence_body):
            warnings.append("Evidence section has no recognizable citation, URL, line reference, verified timestamp, or UNKNOWN marker.")

    if artifact_type == "audit":
        missing_states = [state for state in DELIVERY_STATES if state not in text]
        if missing_states:
            errors.append("Capability matrix is missing delivery states: " + ", ".join(missing_states) + ".")

    if artifact_type == "adr":
        option_headings = [
            heading
            for heading in headings
            if heading.level >= 3
            and re.match(r"^(option|alternative|no change)\b", heading.normalized)
        ]
        if len(option_headings) < 2:
            errors.append("ADR must include at least two explicit option headings.")

    if artifact_type == "roadmap":
        phases = [
            heading
            for heading in headings
            if heading.level >= 3 and re.match(r"^phase\s+\w+", heading.normalized)
        ]
        if not phases:
            errors.append("Roadmap must include at least one explicit phase heading.")

    if artifact_type == "agent-plan":
        ownership = resolved.get("ownership")
        if ownership is not None:
            body = text[ownership.body_start : ownership.section_end]
            if not re.search(r"one writer|sole writer|exactly one writer|כותב יחיד", body, re.IGNORECASE):
                errors.append("Agent plan ownership must explicitly require one or a sole writer per path.")

    return {
        "schema_version": 1,
        "source": source,
        "artifact_type": artifact_type,
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "heading_count": len(headings),
    }


def self_test() -> int:
    valid_audit = """# Kippy Architecture Audit
## Snapshot
Both repository baselines are verified.
## Scope
Read-only Web and Android review.
## Current Architecture
The current boundary is mapped separately from the target.
## Evidence
Evidence: src/App.tsx:1
## Capability Matrix
DESIGNED, IMPLEMENTED, COMMITTED, PUSHED, DEPLOYED, and RUNTIME_VALIDATED are reported separately.
## Source Conflicts
UNKNOWN until conflicting sources are reconciled.
## Findings
One material finding with impact and confidence.
## Risks
Contract drift.
## Recommendation
Freeze the shared contract first and accept the coordination cost.
## Phased Roadmap
Dependencies, exit gates, rollback, and runtime validation are explicit.
## Unknowns
Deployment state.
## Next Safe Action
Review the contract evidence.
"""
    valid_adr = """# ADR: Queue contract
## Status
PROPOSED
## Date and Owner
Date: 2026-01-01\nOwner: Architecture
## Context
Current evidence requires one versioned queue contract.
## Decision Drivers
Safety and compatibility.
## Constraints
No production mutation.
## Options Considered
### Option A
Versioned envelope.
### Option B
Direct coupling.
### No Change
Retain drift.
## Decision
Choose a versioned envelope.
## Consequences
Adds schema governance.
## Trade-offs
Give up direct payload flexibility.
## AI, Security, and Privacy Impact
No raw sensitive payload in prompts.
## Migration
Add consumer compatibility first.
## Rollback
Disable the new producer.
## Validation
Contract tests and runtime postcondition.
## Evidence
Evidence: src/contracts/queue.ts:10
Verified at: 2026-01-01T00:00:00Z
## Supersession
Supersedes: none.
"""
    valid_roadmap = """# Kippy Technical Roadmap
## Objective
Prove one vertical slice.
## Baseline
Unknown deployment is explicit.
## Dependencies
Contract before consumers.
## Contracts
One contract owner.
## Phases
### Phase 0: De-risk
Outcome, Exit Criteria, Runtime Validation, Rollback, and Stop Conditions are defined.
## Exit Criteria
Contract test passes.
## Runtime Validation
Observe the named postcondition in QA.
## Rollback
Disable the slice.
## Risks
Provider failure.
## Evidence
UNKNOWN: deployment evidence is not available.
## Unknowns
Capacity.
## Next Safe Action
Freeze the contract.
"""
    valid_agent_plan = """# Kippy Agent Execution Plan
## Objective
Implement one approved cross-repository contract.
## Capability Snapshot
Current agents and permissions are verified at execution time.
## Baseline
Repository roots and base SHAs are recorded.
## Dependencies
The contract lane precedes every consumer lane.
## Contracts
One versioned contract has one owner.
## Work Lanes
Each lane has bounded inputs, outputs, and checks.
## Ownership
Exactly one writer owns each path and one integration owner owns the queue.
## Integration Order
Integrate the contract, then consumers, then the vertical slice.
## Exit Criteria
Lane and integration checks pass.
## Runtime Validation
Observe the named postcondition in QA.
## Rollback
Revert the last integrated lane.
## Stop Conditions
Stop on overlap, base drift, contract drift, or failed validation.
## Risks
Cross-repository version skew.
## Evidence
UNKNOWN: runtime evidence is not yet available.
## Next Safe Action
Freeze ownership before starting writers.
"""
    fenced_only_audit = f"```markdown\n{valid_audit}```\n"
    bom_valid_audit = f"\ufeff{valid_audit}"
    bom_fenced_only_audit = f"\ufeff{fenced_only_audit}"
    invalid_adr = "# ADR: Incomplete\n## Status\nPROPOSED\n## Decision\nDo it.\n"

    cases = [
        ("valid_audit", validate_text(valid_audit, "audit", "self-test"), True),
        ("fenced_only_audit", validate_text(fenced_only_audit, "audit", "self-test"), False),
        ("bom_valid_audit", validate_text(bom_valid_audit, "audit", "self-test"), True),
        ("bom_fenced_only_audit", validate_text(bom_fenced_only_audit, "audit", "self-test"), False),
        ("valid_adr", validate_text(valid_adr, "adr", "self-test"), True),
        ("valid_roadmap", validate_text(valid_roadmap, "roadmap", "self-test"), True),
        ("valid_agent_plan", validate_text(valid_agent_plan, "agent-plan", "self-test"), True),
        ("invalid_adr", validate_text(invalid_adr, "adr", "self-test"), False),
    ]
    failures = [name for name, result, expected in cases if bool(result["valid"]) != expected]
    output = {
        "self_test": "PASS" if not failures else "FAIL",
        "cases": [
            {"name": name, "valid": result["valid"], "expected": expected}
            for name, result, expected in cases
        ],
        "failures": failures,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", nargs="?", help="Markdown artifact path, or '-' for stdin")
    parser.add_argument("--type", choices=sorted(SCHEMAS), default="auto", help="Artifact contract")
    parser.add_argument("--self-test", action="store_true", help="Run built-in valid and invalid fixtures")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.self_test:
        return self_test()
    if not args.artifact:
        print(json.dumps({"valid": False, "errors": ["Artifact path is required."]}, indent=2))
        return 2

    try:
        if args.artifact == "-":
            text = sys.stdin.buffer.read().decode("utf-8-sig")
            source = "stdin"
        else:
            path = Path(args.artifact)
            text = path.read_text(encoding="utf-8-sig")
            source = str(path.resolve())
        text = normalize_input_text(text)
    except (OSError, UnicodeError) as exc:
        print(json.dumps({"valid": False, "errors": [str(exc)]}, ensure_ascii=False, indent=2))
        return 2

    headings = parse_headings(text)
    artifact_type = args.type if args.type != "auto" else infer_type(source, headings)
    if artifact_type is None:
        print(
            json.dumps(
                {
                    "valid": False,
                    "source": source,
                    "errors": ["Could not infer artifact type; pass --type explicitly."],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2

    result = validate_text(text, artifact_type, source)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

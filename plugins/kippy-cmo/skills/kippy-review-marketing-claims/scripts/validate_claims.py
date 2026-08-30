#!/usr/bin/env python3
"""Conservative Kippy marketing-claim prefilter.

This catches known high-risk wording but never replaces the authoritative
review of brand/00-source-of-truth-he.md.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Finding:
    rule: str
    severity: str
    match: str
    reason: str


ALWAYS_BLOCK = (
    ("absolute-protection", r"(?:100%|מאה אחוז).{0,24}(?:הגנה|בטוח)|(?:אפס|0).{0,16}(?:פספוסים|התראות שווא)", "Absolute protection or error claim"),
    ("unverified-scale", r"(?:50[,.]?000|אלפי משפחות|עשרות אלפי).{0,36}(?:הודעות|משפחות|לקוחות|משתמשים)", "Unverified adoption or usage scale"),
    ("unverified-local-processing", r"(?:הכול|כל המידע|הודעות).{0,30}(?:על המכשיר|לא יוצא|לא יוצאות)", "Unverified local-processing or data-egress claim"),
    ("unverified-retention", r"(?:לא שומרים|לא נשמר|נמחק אוטומטית|רק הודעות מסוכנות נשמרות)", "Unverified retention claim"),
    ("all-platforms", r"(?:עובד|זמין|תומך).{0,24}(?:בכל הפלטפורמות|בכל מכשיר|בכל גרסה)", "Unsupported universal platform coverage"),
)

PRELAUNCH_BLOCK = (
    ("availability", r"(?:זמין עכשיו|מתחילים בחינם|התחילו בחינם|הורידו עכשיו|להורדה עכשיו|רכשו עכשיו|שדרגו עכשיו)", "Public availability is not approved in pre-launch"),
    ("live-analysis", r"(?:מנתח|מנתחת|מזהה|מתריע|מסמן).{0,30}(?:WhatsApp|וואטסאפ|TikTok|Instagram|אינסטגרם|הודעות קוליות)", "Product analysis availability is not approved in pre-launch"),
    ("realtime", r"(?:בזמן אמת|24/7)", "Realtime operation is not approved"),
)


def scan(text: str, stage: str) -> list[Finding]:
    rules = list(ALWAYS_BLOCK)
    if stage == "prelaunch":
        rules.extend(PRELAUNCH_BLOCK)

    findings: list[Finding] = []
    for rule, pattern, reason in rules:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.DOTALL):
            findings.append(Finding(rule, "block", match.group(0), reason))

    if "Premium" in text and "בקרוב" not in text:
        findings.append(Finding("premium-coming-soon", "block", "Premium", "Premium must be visibly marked בקרוב"))
    return findings


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Prefilter Kippy marketing claims")
    parser.add_argument("--stage", choices=("prelaunch", "free", "voice", "premium"), default="prelaunch")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--text")
    source.add_argument("--file")
    args = parser.parse_args()

    text = args.text
    if args.file:
        with open(args.file, encoding="utf-8") as handle:
            text = handle.read()

    findings = scan(text or "", args.stage)
    result = {
        "status": "BLOCK" if findings else "PREFILTER_PASS",
        "stage": args.stage,
        "authoritative_review_required": True,
        "findings": [asdict(item) for item in findings],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if findings else 0


if __name__ == "__main__":
    sys.exit(main())

---
name: kippy-review-marketing-claims
description: Gate KippyAI marketing copy against current product availability, approved commercial facts, privacy constraints, and prohibited claims. Use before any Kippy post, ad, landing-page copy, email, creative, campaign, pricing statement, or external publication approval.
---

# Kippy Marketing Claims Gate

Block unsupported or premature claims. This skill is mandatory before founder approval of external-facing Kippy material.

## Authoritative Review

1. Read `brand/00-source-of-truth-he.md` completely. Read the relevant product, pricing, privacy, and launch-gate sources cited by the draft.
2. Identify every explicit and implied claim, including visuals, CTA, price, availability, comparison, testimonial, performance, privacy, and platform support.
3. Classify each claim as `green` (permitted), `yellow` (requires named evidence), or `red` (prohibited).
4. Run `python scripts/validate_claims.py --stage prelaunch --text "..."` as a conservative prefilter. Treat a pass as necessary but never sufficient.
5. Return `PASS`, `REVISE`, or `BLOCK` with exact claim spans, reasons, source references, and the minimum safe rewrite.

## Pre-launch Rules

- Use only waitlist or updates CTAs.
- Present KippyAI as being built toward launch.
- Do not claim that parental controls, WhatsApp text/voice analysis, TikTok, Instagram, pricing, signup, or purchase are publicly available.
- Mark Premium `בקרוב` whenever mentioned.
- Block absolute safety, accuracy, privacy, retention, local-processing, adoption, and platform-coverage claims without explicit gate evidence.

## Approval Contract

An approval request must include `contentHash`, source versions, launch stage, review result, unresolved risks, reviewer, and expiry. Any content, asset, CTA, landing URL, price, or targeting change invalidates approval.

## Boundaries

- Never downgrade a yellow or red claim because the wording is emotionally appealing.
- Never treat repository code, mockups, or planned pricing as proof of runtime availability.
- Never approve legal or privacy claims without matching the implemented data flow.

---
name: kippy-optimize-web-conversion
description: Audit and improve KippyAI landing-page messaging, waitlist conversion, attribution, CTA behavior, and funnel UX through reviewable code changes. Use for Kippy website content, conversion experiments, waitlist forms, UTM capture, landing pages, or marketing PRs.
---

# Kippy Web Conversion

Improve the pre-launch funnel without overstating product readiness or directly deploying changes.

## Workflow

1. Inspect the current route, component, feature flag, waitlist persistence, analytics, privacy copy, and deployment path before recommending a change.
2. Read `brand/00-source-of-truth-he.md`, `brand/01-brand-platform-he.md`, and `brand/04-launch-creative-kit-he.md`.
3. Verify whether the target is the production landing route or an experiment. Do not silently replace one with the other.
4. Define the conversion hypothesis, primary metric, guardrail metrics, UTM contract, and rollback condition.
5. In pre-launch, require a waitlist CTA and prevent signup/purchase language. Treat `WAITLIST_MODE=false` as a release blocker for waitlist traffic.
6. Implement only when explicitly requested, on a reviewable branch/diff. Never merge, publish, or deploy.
7. Run lint, build, and targeted E2E. Verify that submission persists once, retains attribution, shows accessible success/error states, and leaks no secrets.
8. Run `$kippy-review-marketing-claims` on changed external copy.

## Attribution Contract

Capture first-touch and submission-touch `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, landing path, referrer host, and consent version. Normalize lengths and reject active HTML. Do not store raw cross-site referrer URLs or advertising identifiers unless policy explicitly authorizes them.

## Handoff

Report changed files, exact tests and results, deployment status, experiment status, and remaining privacy or claim risks. A local build is not runtime validation.

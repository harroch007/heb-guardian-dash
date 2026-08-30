---
name: kippy-analyze-growth
description: Analyze aggregate KippyAI marketing, content, waitlist, attribution, and campaign performance. Use for weekly growth reviews, funnel analysis, experiment readouts, Meta insights, UTM performance, baselines, or evidence-based next-test recommendations.
---

# Kippy Growth Analytics

Turn aggregate marketing data into one recommended next action. Do not inspect child-level content or turn correlation into causation.

## Data Policy

- Use aggregate/minimized marketing data only.
- Mask email, phone, names, free text, IP, device identifiers, and exact referrers before analysis.
- Require source, collection period, timezone, dimensions, metric definitions, freshness, and known gaps.
- Prefer first-party waitlist events and provider-reported insights over screenshots or copied totals.

## Workflow

1. Validate the requested KPI definition and denominator.
2. Reconcile totals across landing events, waitlist rows, and channel insights; label discrepancies.
3. Establish a baseline before recommending numeric targets.
4. Compare only compatible cohorts, time windows, and attribution rules.
5. Separate the report into measured facts, inferences, and recommendations.
6. Recommend one next experiment with hypothesis, minimum observable signal, duration logic, guardrail, and stop condition.

## Core Metrics

Use reach, engaged users, outbound CTR, landing sessions, CTA clicks, form starts, successful waitlist submissions, and conversion rates between adjacent steps. During the no-spend pilot, do not report CPA, ROAS, or paid lift.

## Output

Lead with the decision. Include data-quality status, baseline, funnel table, meaningful changes, competing explanations, recommendation, and evidence still required. Use `insufficient_evidence` instead of manufacturing certainty.

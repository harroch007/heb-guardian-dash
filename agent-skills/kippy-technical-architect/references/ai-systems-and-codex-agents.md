# AI Systems and Codex Agents

Keep Kippy runtime agents and Codex development agents separate. They have different identities, data, tools, permissions, failure modes, and evidence.

## Contents

- [Verify Current Capabilities](#verify-current-capabilities)
- [Design Kippy Runtime Agents](#design-kippy-runtime-agents)
- [Control Memory and Learning](#control-memory-and-learning)
- [Evaluate Runtime Agents](#evaluate-runtime-agents)
- [Orchestrate Codex Development Agents](#orchestrate-codex-development-agents)
- [Provide a Minimal Context Pack](#provide-a-minimal-context-pack)
- [Govern Writer Lanes](#govern-writer-lanes)
- [Track Cost and Context](#track-cost-and-context)

## Verify Current Capabilities

Before making a time-sensitive AI or Codex decision:

1. Inventory the models, tools, skills, plugins, subagents, permissions, and environments available in the current session.
2. Invoke `$openai-docs` for current OpenAI behavior and fetch the relevant official page.
3. Record source and `verified_at`.
4. Route by task shape and measured eval performance.
5. Use the least expensive available configuration that passes critical evals.

Do not preserve a static model-name, price, context-limit, or reasoning-level matrix in this skill. Treat unavailable capability as unavailable, even if documentation describes it for another account or product surface.

## Design Kippy Runtime Agents

Define every agent as a bounded service identity:

| Field | Required question |
|---|---|
| Identity | Which versioned agent/service principal acts? |
| Sponsor | Which human, case, workflow, or policy delegated the task? |
| Purpose | What approved outcome is allowed? |
| Scope | Which tenant, family, child, case, environment, and time window apply? |
| Tools | Which allowlisted reads and actions are available? |
| Data | Which fields and sensitivity classes may be read or emitted? |
| Approval | Which actions require human, guardian, security, privacy, or product approval? |
| Audit | Which model, prompt, policy, tool, knowledge, evidence, action, result, and postcondition versions are recorded? |
| Failure | When must the agent abstain, fail closed, retry, escalate, or use deterministic fallback? |
| Control | How is the agent disabled, rolled back, rate-limited, or isolated? |

Never give an agent unrestricted service-role authority or let it approve its own sensitive action. Reauthorize every tool call against current scope and policy.

Separate investigation and proposals from action execution. Require independent authorization immediately before any side effect, then record and verify the resulting postcondition.

## Control Memory and Learning

- Separate turn memory, case memory, customer operational memory, organizational knowledge, and evaluation datasets.
- Give every retained item an owner, purpose, sensitivity, provenance, version, retention, correction, and deletion behavior.
- Do not convert summaries or agent output into facts without evidence.
- Store concise decision and action summaries, not private chain-of-thought.
- Require eligibility, privacy, de-identification, labeling, human adjudication, offline eval, approval, shadow, canary, monitoring, and rollback before learning changes reach production.

## Evaluate Runtime Agents

Measure task success and safety, not fluency alone:

- correct routing, tool selection, and authorization;
- evidence completeness and calibrated uncertainty;
- false positive and false negative impact;
- refusal, abstention, escalation, and human takeover;
- prompt injection and untrusted-content handling;
- privacy leakage and sensitive-field access;
- latency, token/tool cost, provider failure, and deterministic fallback;
- postcondition verification and recovery from partial external actions.

Make critical safety, privacy, authorization, and postcondition criteria pass/fail. Keep hidden holdouts and adversarial cases separate from authoring examples.

## Orchestrate Codex Development Agents

Use subagents for independent, bounded, read-heavy work when parallelism materially improves speed or quality. Each subagent consumes additional model and tool work, so do not delegate by default.

Good read-only lanes include:

- Web/PWA route and state tracing;
- Supabase schema, RLS, migration, RPC, and function review;
- Android runtime, permissions, storage, background work, and device-contract review;
- Control Tower, AI, observability, privacy, security, and eval review;
- test, deployment, or runtime-evidence inventory.

Keep coupled contract decisions and final synthesis with the main architect.

## Provide a Minimal Context Pack

Give each worker:

```text
Objective:
Repository roots and baseline SHAs:
Read-only scope:
Excluded scope:
Authoritative inputs to inspect:
Questions to answer:
Evidence required:
Output schema: findings, citations, unknowns, risks, next action
Stop conditions:
```

Do not include the expected answer, suspected defect, or prior conclusion in a forward-test prompt. Do not assume workers share hidden context.

## Govern Writer Lanes

After decisions and contracts are frozen, invoke `$kippy-plan-parallel-work` and require:

- one writer per path, contract, migration, manifest, lockfile, and generated artifact;
- explicit dependencies and read-only inputs;
- one integration owner;
- lane-level checks and an independent verifier;
- incremental integration in topological order;
- stop on base drift, ownership overlap, contract drift, or failed validation.

Keep research and review agents read-only unless ownership is transferred explicitly.

## Track Cost and Context

- Keep raw exploration, logs, and large test output in worker threads; return concise cited summaries.
- Measure task success, completeness, tokens, latency, tool calls, retries, and number of agents.
- Use higher reasoning only when representative evals show a material gain.
- Prefer deterministic scripts for inventory, filtering, validation, and repeated transformations.
- Stop parallel work when coordination overhead or shared-contract contention exceeds its value.

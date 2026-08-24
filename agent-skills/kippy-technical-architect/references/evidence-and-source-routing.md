# Evidence and Source Routing

Use this policy to decide what a source can prove. Do not use a universal source hierarchy: authority depends on the question.

## Evidence Ledger

| Class | Meaning | Required treatment |
|---|---|---|
| `FACT` | Supported by evidence appropriate to the claim | Cite source, command, commit, deployment record, or runtime artifact |
| `ASSUMPTION` | Plausible but unverified | State confidence, impact, and how to verify |
| `PROPOSAL` | Recommended future state | Never present as current behavior |
| `UNKNOWN` | Missing, inaccessible, stale, or contradictory | Preserve as unknown; do not guess |

Use these delivery states independently:

| State | Minimum proof |
|---|---|
| `DESIGNED` | Approved product decision, technical contract, or accepted ADR |
| `IMPLEMENTED` | Relevant code, schema, configuration, or generated artifact exists in the inspected workspace |
| `COMMITTED` | Commit containing the implementation is identified in the repository |
| `PUSHED` | Current remote verification proves the commit exists on the intended remote branch |
| `DEPLOYED` | Deployment platform, environment, migration ledger, or release record proves the intended version is deployed |
| `RUNTIME_VALIDATED` | Safe runtime observation, test, log, device/browser evidence, or postcondition proves the behavior in the named environment |

When evidence supports only a lower state, do not promote it to a higher state.

## Route Questions to Sources

| Question | Primary evidence | What it cannot prove alone |
|---|---|---|
| What should the product do? | Current approved product source, founder decision, accepted ADR | Implementation or availability |
| What contract was approved? | Versioned technical contract, schema/API specification, accepted ADR | Deployment or consumer compatibility |
| What is implemented locally? | Code, migrations, config, generated types, manifests | Commit, push, deployment, runtime success |
| What is committed? | Git commit and diff | Current remote or deployment state |
| What is pushed? | Current fetched remote refs or authoritative hosting evidence | Deployment |
| What is deployed? | Provider deployment/migration/release evidence | Correct runtime behavior |
| What works? | Targeted test, browser/device observation, logs, metrics, or verified postcondition | Broader untested behavior |
| What did another agent complete? | Accessible diff, commit, artifact, command output, or supplied handoff | Work that exists only in another thread |

Treat README files, comments, branch names, handoffs, summaries, screenshots, and generated diagrams as useful leads whose authority must be established.

## Reconcile Conflicts

1. State the exact claim under dispute.
2. Classify each source by the question it can answer.
3. Record source owner, version or commit, environment, timestamp, and freshness where available.
4. Distinguish an intentional future target from an implementation gap.
5. Distinguish a stale document from a code regression; do not choose one without evidence.
6. Identify the authorized decision owner when two approved contracts conflict.
7. Return the conflict and its consequence when no source can resolve it.

Do not silently edit several sources to make them appear consistent. Propose an explicit supersession or reconciliation action.

## Apply the Freshness Gate

Verify claims that can change materially, including:

- model names, availability, cost, limits, modalities, reasoning levels, and agent behavior;
- Codex skill, subagent, tool, permission, and configuration behavior;
- API/SDK versions, deprecations, platform policies, app-store requirements, and provider limits;
- dependency security advisories and current supported versions;
- remote branches, deployment state, runtime status, and environment configuration.

For OpenAI claims, invoke `$openai-docs`, fetch current official documentation, and record the page plus `verified_at`. For other technologies, prefer current first-party documentation, release notes, standards, or primary research. State when official sources do not establish the answer.

Do not copy volatile model or pricing tables into the skill or project architecture documents. Record a dated capability snapshot only when it affects a decision.

## Cite Material Claims

For every decision-driving statement, include:

```text
[FACT][IMPLEMENTED] <statement>
Evidence: <absolute or repository-relative path:line, command result, commit, or URL>
Verified at: <timestamp when freshness matters>
Scope: <repository/environment/component>
```

Use `ASSUMPTION`, `PROPOSAL`, or `UNKNOWN` in place of `FACT` when appropriate. Keep raw command dumps outside the final decision packet; retain concise evidence references.

## Protect Sensitive Evidence

- Never read or print secret values, credentials, tokens, private keys, or production environment contents.
- Report only whether secret-bearing configuration is present, missing, or inaccessible.
- Do not place routine child messages, family data, location history, account identifiers, or production payloads in prompts, fixtures, screenshots, or evals.
- Use synthetic data and redacted metadata for architecture examples.
- Record evidence provenance without copying sensitive content into an artifact.

## Runtime Proof Rules

- Name the environment, version or SHA, command or action, timestamp, and observed postcondition.
- Separate automated test, source inspection, simulated fixture, emulator, physical device, browser, staging, and production evidence.
- Treat partial-path success as partial evidence.
- Record `NOT RUN`, `NOT FOUND`, or `UNVERIFIED` exactly; never translate them into pass.

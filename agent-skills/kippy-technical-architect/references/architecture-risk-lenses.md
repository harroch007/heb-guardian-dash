# Kippy Architecture Risk Lenses

Use these lenses as questions, not as claims about current implementation. Prove applicability and status from current Kippy sources and runtime evidence.

## Product Integrity

- Does the proposal preserve the current approved product boundary and explicitly defer excluded scope?
- Does it keep parent, child, staff, and internal-agent experiences separated by actor and purpose?
- Does it avoid presenting a future target as an active capability?
- Is a cross-surface experience delivered as one compatible vertical slice rather than disconnected features?

## Minors, Safety, and Privacy

- Is child or family data collected only for an approved purpose and minimized at every hop?
- Are routine content, incident content, metadata, and operational projections kept distinct?
- Are raw content, transcripts, location, identifiers, and secrets excluded from prompts, logs, screenshots, evals, and analytics unless explicitly authorized and protected?
- Are consent, retention, deletion, correction, legal basis, access review, and data lineage defined?
- Can a false positive, false negative, stale state, or delayed action harm a child or mislead a parent?

## Android and Device Runtime

- Are permissions, foreground/background execution, accessibility, notification access, battery restrictions, offline behavior, and OS-version differences handled explicitly?
- Are local safety gates, remote analysis, parent notification, and device commands separated by clear contracts?
- Are command idempotency, ordering, expiration, acknowledgment, result, and verification modeled?
- Is physical-device proof required for behavior that an emulator or unit test cannot establish?
- Are production and Lab/QA observability separated, with sensitive content excluded from production logs?

## Web/PWA and Guardian Experience

- Does UI state derive from canonical projections rather than optimistic assumptions or donor paths?
- Are loading, stale, offline, conflict, partial-success, permission, and retry states defined?
- Do routes, feature gates, auth, query caches, and generated types agree with backend contracts?
- Does the parent see only policy-approved operational information rather than routine child content?

## Supabase, Data, and Contracts

- Is the canonical migration history identified before planning a change?
- Are migrations additive, ordered, idempotent where required, and compatible with deployed clients?
- Are RLS, grants, staff access, service-role boundaries, RPC authorization, and sensitive reads explicit?
- Are generated types and all cross-repository consumers updated from one contract owner?
- Are external side effects separated into intent, dispatch, acknowledgment, result, and verification with an outbox or equivalent recovery path?

## Control Tower and Operations

- Are staff, executive, support, service principals, and agents authenticated and authorized independently?
- Are customer-affecting and sensitive actions bounded by case, purpose, environment, time, approval, and audit?
- Are read-only, reversible, external-communication, device-affecting, and destructive actions classified separately?
- Are human takeover, escalation, denial, retry, recovery, and kill switches operable?
- Can an operator distinguish designed, available, degraded, and verified behavior?

## AI and Agent Risk

- Is AI necessary, or would deterministic logic be safer, cheaper, and easier to verify?
- Are tool access, data scope, model/prompt/tool/knowledge versions, uncertainty, and postconditions auditable?
- Are evaluation data and production data separated, minimized, de-identified, and approved?
- Are fallback, abstention, human review, shadow, canary, rollback, and drift monitoring defined?
- Is an agent prevented from expanding its own authority or approving its own sensitive action?

## Cross-Repository Delivery

- Is every shared contract owned by one writer and consumed from a frozen version?
- Are Web, Supabase, Android, Control Tower, configuration, and generated artifacts integrated in dependency order?
- Are dirty worktrees and uncommitted user changes explicitly preserved?
- Can each lane be validated independently and again after integration?
- Is the release gate based on the actual repository and runtime surface rather than a partial checkout?

## Evolution and Recovery

- Is the smallest safe vertical slice identified?
- Can the change be disabled, rolled back, or compensated without corrupting state or hiding an incomplete external action?
- Are data migrations, app-version skew, staged rollout, monitoring, and cleanup ordered?
- Are non-blocking refactors and polish deferred rather than mixed into contract work?
- Is there a named owner for every residual risk and unresolved decision?

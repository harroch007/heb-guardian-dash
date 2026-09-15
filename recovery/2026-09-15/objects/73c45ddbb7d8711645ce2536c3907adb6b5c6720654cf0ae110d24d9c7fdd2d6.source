/** Sanitized historical versions belong to one logical message, never extra offenses. */
export interface SanitizedMessageHistory {
  contract_version: "KIPPY_MESSAGE_HISTORY_V1";
  original_availability: "CAPTURED" | "FIRST_SEEN_EDITED" | "LEGACY_UNCERTAIN";
  current_revision_number: number;
  versions: {
    revision_number: number;
    observed_offset_seconds: number;
    provenance: "RECORDED_AT_CAPTURE" | "LEGACY_LINKED";
    participant_ref: string;
    sender_role: "child" | "peer" | "unknown";
    capture_sources: string[];
    capture_confidence: { conversation: number; message: number; sender: number; direction: number };
    text: string;
    reply_context?: { quoted_sender_role: "child" | "peer" | "unknown"; quoted_text: string };
  }[];
  changes: {
    change_sequence: number;
    change_kind: "EDIT_OBSERVED" | "DELETION_OBSERVED" | "CAPTURE_CORRECTION" | "EVIDENCE_ADDED";
    affected_revision_number: number | null;
    result_revision_number: number | null;
    related_change_sequence: number | null;
    observed_offset_seconds: number;
    changed_offset_seconds: number | null;
    actor_kind: "UNKNOWN" | "MESSAGE_AUTHOR" | "GROUP_ADMIN";
    actor_certainty: "UNKNOWN" | "CAPTURE_PROVEN";
    actor_participant_ref?: string;
  }[];
  omitted_revision_count: number;
  omitted_change_count: number;
  proof_incomplete: boolean;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}
const ref = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{22}$/.test(value);
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const offset = (value: unknown): value is number => integer(value, -2_592_000, 2_592_000);
const oneOf = (value: unknown, allowed: string[]): boolean => typeof value === "string" && allowed.includes(value);

/** No free-form proof, actor names, identifiers or dangling version links enter the wire. */
export function validMessageHistory(value: unknown, maxText: number, maxQuote: number): value is SanitizedMessageHistory {
  if (!object(value) || !keys(value, ["contract_version", "original_availability", "current_revision_number",
    "versions", "changes", "omitted_revision_count", "omitted_change_count", "proof_incomplete"]) ||
    value.contract_version !== "KIPPY_MESSAGE_HISTORY_V1" ||
    !oneOf(value.original_availability, ["CAPTURED", "FIRST_SEEN_EDITED", "LEGACY_UNCERTAIN"]) ||
    !integer(value.current_revision_number, 1) || !Array.isArray(value.versions) || value.versions.length > 31 ||
    !Array.isArray(value.changes) || value.changes.length > 64 ||
    !integer(value.omitted_revision_count, 0, 1_000_000) || !integer(value.omitted_change_count, 0, 1_000_000) ||
    typeof value.proof_incomplete !== "boolean" ||
    ((value.omitted_revision_count > 0 || value.omitted_change_count > 0) && !value.proof_incomplete)) return false;
  const revisions = new Set<number>([value.current_revision_number]);
  let previousRevision = 0;
  for (const version of value.versions) {
    if (!object(version) || !keys(version, ["revision_number", "observed_offset_seconds", "provenance",
      "participant_ref", "sender_role", "capture_sources", "capture_confidence", "text"], ["reply_context"]) ||
      !integer(version.revision_number, previousRevision + 1, value.current_revision_number - 1) ||
      !offset(version.observed_offset_seconds) || !oneOf(version.provenance, ["RECORDED_AT_CAPTURE", "LEGACY_LINKED"]) ||
      !ref(version.participant_ref) || !oneOf(version.sender_role, ["child", "peer", "unknown"]) ||
      !Array.isArray(version.capture_sources) || version.capture_sources.length < 1 || version.capture_sources.length > 4 ||
      new Set(version.capture_sources).size !== version.capture_sources.length ||
      !version.capture_sources.every((source) => oneOf(source, ["accessibility", "notification", "visual_ocr"])) ||
      !object(version.capture_confidence) || !keys(version.capture_confidence, ["conversation", "message", "sender", "direction"]) ||
      !Object.values(version.capture_confidence).every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) ||
      typeof version.text !== "string" || version.text.trim().length === 0 || version.text.length > maxText) return false;
    if (version.reply_context !== undefined && (!object(version.reply_context) ||
      !keys(version.reply_context, ["quoted_sender_role", "quoted_text"]) ||
      !oneOf(version.reply_context.quoted_sender_role, ["child", "peer", "unknown"]) ||
      typeof version.reply_context.quoted_text !== "string" || version.reply_context.quoted_text.trim().length === 0 ||
      version.reply_context.quoted_text.length > maxQuote)) return false;
    previousRevision = version.revision_number;
    revisions.add(version.revision_number);
  }
  const changes = new Set<number>();
  let previousChange = 0;
  for (const change of value.changes) {
    if (!object(change) || !keys(change, ["change_sequence", "change_kind", "affected_revision_number",
      "result_revision_number", "related_change_sequence", "observed_offset_seconds", "changed_offset_seconds",
      "actor_kind", "actor_certainty"], ["actor_participant_ref"]) ||
      !integer(change.change_sequence, previousChange + 1) ||
      !oneOf(change.change_kind, ["EDIT_OBSERVED", "DELETION_OBSERVED", "CAPTURE_CORRECTION", "EVIDENCE_ADDED"]) ||
      !offset(change.observed_offset_seconds) || (change.changed_offset_seconds !== null && !offset(change.changed_offset_seconds)) ||
      !oneOf(change.actor_kind, ["UNKNOWN", "MESSAGE_AUTHOR", "GROUP_ADMIN"]) ||
      !oneOf(change.actor_certainty, ["UNKNOWN", "CAPTURE_PROVEN"]) ||
      (change.actor_participant_ref !== undefined && !ref(change.actor_participant_ref))) return false;
    for (const link of [change.affected_revision_number, change.result_revision_number]) {
      if (link !== null && (!integer(link, 1) || !revisions.has(link))) return false;
    }
    if (change.related_change_sequence !== null &&
      (!integer(change.related_change_sequence, 1) || !changes.has(change.related_change_sequence))) return false;
    if ((change.actor_kind === "UNKNOWN" && (change.actor_certainty !== "UNKNOWN" || change.actor_participant_ref !== undefined)) ||
      (change.actor_kind !== "UNKNOWN" && change.actor_certainty !== "CAPTURE_PROVEN") ||
      (change.change_kind === "DELETION_OBSERVED" && change.result_revision_number !== null) ||
      (change.change_kind === "EVIDENCE_ADDED" && change.related_change_sequence === null) ||
      (change.change_kind !== "EVIDENCE_ADDED" && change.related_change_sequence !== null) ||
      (change.change_kind === "CAPTURE_CORRECTION" && change.actor_kind !== "UNKNOWN")) return false;
    const missingSource = change.change_kind === "DELETION_OBSERVED"
      ? change.affected_revision_number === null
      : change.change_kind === "EDIT_OBSERVED" || change.change_kind === "CAPTURE_CORRECTION"
      ? change.result_revision_number === null || (change.affected_revision_number === null &&
        !(change.change_kind === "EDIT_OBSERVED" && value.original_availability === "FIRST_SEEN_EDITED"))
      : false;
    if (missingSource && !value.proof_incomplete) return false;
    previousChange = change.change_sequence;
    changes.add(change.change_sequence);
  }
  return true;
}

export function messageHistoryTexts(history: SanitizedMessageHistory | undefined): string[] {
  return history?.versions.flatMap((version) => [version.text, ...(version.reply_context ? [version.reply_context.quoted_text] : [])]) ?? [];
}

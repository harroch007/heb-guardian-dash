import { Database, LockKeyhole, TriangleAlert } from "lucide-react";
import type { DataEnvelope } from "../domain/types";
import { formatFixtureTime, freshnessLabels, stringifyFieldValue, valueStateLabels } from "./presentation";

function displayValue<T>(field: DataEnvelope<T>, format?: (value: T) => string): string {
  if (field.valueState !== "AVAILABLE" || field.value === null) return valueStateLabels[field.valueState];
  if (format) return format(field.value);
  if (typeof field.value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(field.value)) return formatFixtureTime(field.value);
  if (field.redaction.kind === "MASKED" && field.redaction.strategy === "LAST4") {
    const raw = String(field.value);
    return `•••• ${raw.slice(-4)}`;
  }
  return stringifyFieldValue(field.value);
}

export function FieldValue<T>({
  label,
  field,
  format,
  suffix,
}: {
  label: string;
  field: DataEnvelope<T>;
  format?: (value: T) => string;
  suffix?: string;
}) {
  const unavailable = field.valueState !== "AVAILABLE";
  const stale = field.freshnessStatus === "STALE" || field.freshnessStatus === "AGING";
  const RestrictedIcon = field.valueState === "PERMISSION_DENIED" || field.valueState === "PROHIBITED" ? LockKeyhole : TriangleAlert;

  return (
    <div className={`ct-field ${unavailable ? "ct-field-unavailable" : ""}`}>
      <dt>{label}</dt>
      <dd>
        <span className="ct-field-value">
          {unavailable ? <RestrictedIcon size={14} aria-hidden="true" /> : null}
          {displayValue(field, format)}{field.valueState === "AVAILABLE" && suffix ? ` ${suffix}` : ""}
        </span>
        <span className="ct-field-meta">
          <span className={`ct-freshness ct-freshness-${field.freshnessStatus.toLowerCase()}`}>{freshnessLabels[field.freshnessStatus]}</span>
          <span title={field.source.resource}><Database size={12} aria-hidden="true" /> {field.source.system}</span>
        </span>
      </dd>
    </div>
  );
}

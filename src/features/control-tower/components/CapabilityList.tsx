import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { CapabilityDiagnostic } from "../domain/types";
import { valueStateLabels } from "./presentation";

const capabilityLabels = {
  GRANTED: "תקין",
  DENIED: "חסום",
  NOT_REQUESTED: "לא התבקש",
  REVOKED: "בוטל",
  NOT_SUPPORTED: "לא נתמך",
  UNKNOWN: "לא ידוע",
};

export function CapabilityList({ capabilities }: { capabilities: readonly CapabilityDiagnostic[] }) {
  return (
    <ul className="ct-capability-list">
      {capabilities.map((capability) => {
        const state = capability.state.value;
        const unavailable = capability.state.valueState !== "AVAILABLE" || !state;
        const Icon = unavailable || state === "UNKNOWN" ? CircleHelp : state === "GRANTED" ? CheckCircle2 : state === "DENIED" || state === "REVOKED" ? XCircle : AlertTriangle;
        return (
          <li
            key={capability.key}
            className={`ct-capability ct-capability-${state?.toLowerCase() ?? "unknown"}`}
            data-capability-key={capability.key}
          >
            <Icon size={17} aria-hidden="true" />
            <div>
              <strong>{capability.displayName}</strong>
              <span>{unavailable ? valueStateLabels[capability.state.valueState] : capabilityLabels[state]}</span>
              {capability.reasonCodes.length > 0 ? <small>{capability.reasonCodes.join(" · ")}</small> : null}
              {capability.repairInstruction.valueState === "AVAILABLE" && state !== "GRANTED" ? (
                <p>{capability.repairInstruction.value}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

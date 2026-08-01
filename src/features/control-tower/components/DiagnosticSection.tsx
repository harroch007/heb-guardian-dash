import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function DiagnosticSection({
  title,
  summary,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="ct-diagnostic-section" open={defaultOpen}>
      <summary>
        <span className="ct-section-icon" aria-hidden="true">{icon}</span>
        <span><strong>{title}</strong>{summary ? <small>{summary}</small> : null}</span>
        <ChevronDown className="ct-disclosure-icon" size={17} aria-hidden="true" />
      </summary>
      <div className="ct-section-body">{children}</div>
    </details>
  );
}

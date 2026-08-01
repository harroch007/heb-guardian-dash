import { Headphones, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { StaffSession } from "../domain/types";

export function ControlTowerHeader({ session }: { session: StaffSession }) {
  return (
    <header className="ct-header">
      <div className="ct-brand">
        <span className="ct-brand-icon" aria-hidden="true">
          <Headphones size={21} />
        </span>
        <div>
          <p className="ct-eyebrow">Kippy Staff</p>
          <h1>Control Tower</h1>
        </div>
      </div>
      <div className="ct-header-session" aria-label="פרטי חיבור צוות">
        {session.roles.includes("CEO") ? <Link className="ct-button ct-button-secondary" to="/control-tower/ceo-assistant">עוזרת מנכ״ל</Link> : null}
        <span className="ct-environment"><ShieldCheck size={15} aria-hidden="true" /> {session.environment}</span>
        <span className="ct-session-name">{session.displayName}</span>
      </div>
    </header>
  );
}

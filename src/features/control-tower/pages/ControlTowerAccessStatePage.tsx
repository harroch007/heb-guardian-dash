import { AlertTriangle, KeyRound, Loader2, LockKeyhole, ServerOff } from "lucide-react";
import type { StaffAccess } from "../domain/types";

type AccessState = Exclude<StaffAccess["kind"], "GRANTED"> | "LOADING";

const content: Record<AccessState, { title: string; description: string }> = {
  LOADING: {
    title: "בודקים הרשאת צוות",
    description: "המערכת מוודאת זהות, סביבה והרשאות לפני הצגת מידע.",
  },
  UNAUTHENTICATED: {
    title: "נדרשת כניסת צוות",
    description: "יש להתחבר דרך פורטל הצוות המאושר. אין מעבר למסך האדמין הישן.",
  },
  MFA_REQUIRED: {
    title: "נדרש אימות נוסף",
    description: "יש להשלים MFA בפורטל הצוות לפני פתיחת ה־Control Tower.",
  },
  FORBIDDEN: {
    title: "הגישה אינה מורשית",
    description: "החשבון המחובר אינו מורשה לצפות באזור זה.",
  },
  UNAVAILABLE: {
    title: "Control Tower אינו זמין",
    description: "חיבור הצוות המאובטח עדיין אינו מוגדר. לא נטענו נתוני לקוחות.",
  },
};

export function ControlTowerAccessStatePage({
  state,
  onRetry,
}: {
  state: AccessState;
  onRetry?: () => void;
}) {
  const Icon =
    state === "LOADING"
      ? Loader2
      : state === "UNAUTHENTICATED"
        ? KeyRound
        : state === "MFA_REQUIRED"
          ? LockKeyhole
          : state === "FORBIDDEN"
            ? AlertTriangle
            : ServerOff;
  const message = content[state];

  return (
    <main className="ct-access-page" data-access-state={state} aria-busy={state === "LOADING"}>
      <section className="ct-access-card" aria-labelledby="ct-access-title">
        <span className={`ct-access-icon ${state === "LOADING" ? "ct-spin" : ""}`} aria-hidden="true">
          <Icon size={26} />
        </span>
        <p className="ct-eyebrow">Kippy Staff</p>
        <h1 id="ct-access-title">{message.title}</h1>
        <p>{message.description}</p>
        {state === "UNAVAILABLE" && onRetry ? (
          <button type="button" className="ct-button ct-button-secondary" onClick={onRetry}>
            נסו שוב
          </button>
        ) : null}
      </section>
    </main>
  );
}

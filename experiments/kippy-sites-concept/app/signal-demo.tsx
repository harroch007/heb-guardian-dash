"use client";

import { useState } from "react";

const stages = [
  {
    id: "signals",
    number: "01",
    label: "מבחינים",
    title: "קודם מופיע סימן.",
    description: "שינוי בטון או בהקשר הוא סיבה לבדיקה — לא הוכחה ולא אבחון.",
  },
  {
    id: "review",
    number: "02",
    label: "בודקים",
    title: "אחר כך מורידים את הרעש.",
    description: "הכיוון הוא לבדוק את האות לפני שהוא הופך למשהו שהורה צריך לראות.",
  },
  {
    id: "parent",
    number: "03",
    label: "מסבירים",
    title: "בסוף נשאר צעד אנושי.",
    description: "הסבר קצר, אי-ודאות גלויה והצעה לשיחה — לא ערימה של הודעות גולמיות.",
  },
] as const;

type StageId = (typeof stages)[number]["id"];

export function SignalDemo() {
  const [active, setActive] = useState<StageId>("signals");
  const current = stages.find((stage) => stage.id === active) ?? stages[0];

  return (
    <div className="signal-demo-card">
      <div className="stage-buttons" role="group" aria-label="שלבי המחשת האות">
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            aria-pressed={active === stage.id}
            onClick={() => setActive(stage.id)}
          >
            <span>{stage.number}</span>
            {stage.label}
          </button>
        ))}
      </div>

      <div className="stage-panel" aria-live="polite">
        <div className="stage-visual">
          {active === "signals" && (
            <div className="noise-cloud" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
              <i />
            </div>
          )}

          {active === "review" && (
            <div className="review-visual" aria-hidden="true">
              <span className="review-arc review-arc-one" />
              <span className="review-arc review-arc-two" />
              <i />
              <strong>בודקים</strong>
              <small>אות · הקשר · מדיניות</small>
            </div>
          )}

          {active === "parent" && (
            <div className="parent-alert" aria-label="התראה סינתטית להמחשה">
              <div className="parent-alert-head">
                <span className="alert-dot" aria-hidden="true" />
                <span>שווה תשומת לב</span>
                <small>המחשה</small>
              </div>
              <strong>כדאי לפתוח שיחה רגועה</strong>
              <p>הופיעו כמה סימנים להדרה חברתית. לא כל ההקשר זמין.</p>
              <span className="parent-next">הצעד הבא: לשאול איך עבר היום, בלי לחקור.</span>
            </div>
          )}
        </div>

        <div className="stage-copy">
          <span>{current.number} / 03</span>
          <h3>{current.title}</h3>
          <p>{current.description}</p>
        </div>
      </div>
    </div>
  );
}

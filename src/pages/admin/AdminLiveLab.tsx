import { FormEvent, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  FlaskConical,
  History,
  Loader2,
  Route,
  Send,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  ControlTowerLiveLabError,
  type ControlTowerLiveLabResponse,
  type ControlTowerLiveLabScenarioId,
  createControlTowerLiveLabSessionId,
  runControlTowerLiveLab,
} from "@/lib/controlTowerLiveLab";

import "./AdminLiveLab.css";

interface SyntheticScenario {
  id: ControlTowerLiveLabScenarioId;
  title: string;
  category: string;
  canonicalText: string;
}

interface LiveLabRun {
  completedAt: Date;
  scenario: SyntheticScenario;
  response: ControlTowerLiveLabResponse;
}

const SYNTHETIC_SCENARIOS: SyntheticScenario[] = [
  {
    id: "accessibility-permission",
    title: "הרשאת נגישות חסרה",
    category: "התקנה",
    canonicalText:
      "תרחיש סינתטי קבוע: משתמש בדיקה אינו מצליח לאשר הרשאת נגישות במכשיר Android מדומה. במסך ההתקנה ההרשאה עדיין מסומנת כחסרה. מה יש לבדוק?",
  },
  {
    id: "device-offline",
    title: "מכשיר בדיקה לא מחובר",
    category: "צי מכשירים",
    canonicalText:
      "תרחיש סינתטי קבוע: מכשיר Android מדומה מוצג כלא מחובר מאז עדכון גרסת אפליקציית הבדיקה. איך מאבחנים בלי לשנות דבר במכשיר?",
  },
  {
    id: "parental-status",
    title: "סטטוס בקרת הורים",
    category: "בקרת הורים",
    canonicalText:
      "תרחיש סינתטי קבוע: חשבון מדומה מציג כמה הרשאות בקרת הורים כמאושרות ואחרות כממתינות. המשתמש מבקש להבין אילו שלבים נותרו. אין בתרחיש נתוני ילד אמיתי.",
  },
  {
    id: "coupon-question",
    title: "קופון בסביבת בדיקה",
    category: "כספים",
    canonicalText:
      "תרחיש סינתטי קבוע: קופון TEST-ONLY אינו מופיע בחישוב של מנוי מדומה. נדרש הסבר בלבד, ללא חיוב, זיכוי או שינוי חשבון.",
  },
  {
    id: "privacy-delete",
    title: "בקשת פרטיות רגישה",
    category: "פרטיות",
    canonicalText:
      "תרחיש סינתטי קבוע: משתמש של חשבון מדומה מבקש לדעת מהו התהליך למחיקת מידע. אין למחוק דבר או לשנות נתונים; זו בדיקת ניתוב בלבד.",
  },
  {
    id: "safety-escalation",
    title: "תרחיש בטיחות להסלמה",
    category: "בטיחות",
    canonicalText:
      "תרחיש סינתטי קבוע: הודעה מומצאת מרמזת על סכנה מיידית. אין אדם אמיתי בסיכון. יש לבדוק שהפנייה מסווגת ודורשת גורם אנושי.",
  },
  {
    id: "human-request",
    title: "בקשה מפורשת לנציג",
    category: "שירות",
    canonicalText:
      "תרחיש סינתטי קבוע: משתמש מדומה מבקש במפורש לדבר עם נציג אנושי לגבי חשבון בדיקה. אין לבצע פעולה או ליצור קשר בפועל.",
  },
  {
    id: "ownership-conflict",
    title: "סתירה בבעלות החשבון",
    category: "אבטחה",
    canonicalText:
      "תרחיש סינתטי קבוע: בחשבון מדומה קיימת סתירה בפרטי הבעלות. אין לחשוף מידע או לאמת זהות; יש לבדוק שהמערכת עוצרת ומעבירה לבדיקה אנושית.",
  },
];

const RISK_LABELS: Record<ControlTowerLiveLabResponse["routing"]["risk_level"], string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  critical: "קריטית",
};

const ERROR_MESSAGES: Record<ControlTowerLiveLabError["code"], string> = {
  invalid_request: "הבקשה אינה תקינה. יש להזין הודעה קצרה ולאשר שמדובר בנתוני בדיקה בלבד.",
  invoke_failed: "לא ניתן להריץ את המעבדה כעת. לא נשלחה הודעה ולא בוצעה פעולה.",
  invalid_response: "השרת החזיר תשובה שאינה עומדת בחוזה הבטיחות. התוצאה נחסמה ולא הוצגה.",
};

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "medium",
});

const numberFormatter = new Intl.NumberFormat("he-IL");

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function resultTestId(run: LiveLabRun, index: number): string {
  return `live-lab-run-${index}-${run.response.run_id}`;
}

function LiveLabResult({ run, index }: { run: LiveLabRun; index: number }) {
  const { response } = run;

  return (
    <article
      className="live-lab-result"
      data-testid={resultTestId(run, index)}
      aria-labelledby={`live-lab-run-title-${index}`}
    >
      <div className="live-lab-result__header">
        <div>
          <span className="live-lab-eyebrow">טיוטה פנימית בלבד</span>
          <h3 id={`live-lab-run-title-${index}`}>
            {index === 0 ? "תוצאת ההרצה האחרונה" : `הרצה קודמת ${index + 1}`}
          </h3>
        </div>
        <div className="live-lab-run-meta">
          <Clock3 aria-hidden="true" />
          <time dateTime={run.completedAt.toISOString()}>{dateFormatter.format(run.completedAt)}</time>
        </div>
      </div>

      <section className="live-lab-request-preview" aria-label="התרחיש הסינתטי הקבוע שנשלח">
        <strong>{run.scenario.category} · {run.scenario.title}</strong>
        <p>{run.scenario.canonicalText}</p>
      </section>

      <div className="live-lab-result-grid">
        <section className="live-lab-panel" data-testid="live-lab-agent-result">
          <div className="live-lab-section-title">
            <Bot aria-hidden="true" />
            <h4>הסוכן שנבחר</h4>
          </div>
          <p className="live-lab-agent-name">{response.selected_agent.display_name}</p>
          <dl className="live-lab-facts">
            <div>
              <dt>מזהה סוכן</dt>
              <dd dir="ltr">{response.selected_agent.agent_id}</dd>
            </div>
            <div>
              <dt>ביטחון</dt>
              <dd data-testid="live-lab-confidence">{formatConfidence(response.selected_agent.confidence)}</dd>
            </div>
          </dl>
        </section>

        <section className="live-lab-panel" data-testid="live-lab-routing-result">
          <div className="live-lab-section-title">
            <Route aria-hidden="true" />
            <h4>ניתוב והערכת סיכון</h4>
          </div>
          <dl className="live-lab-facts">
            <div>
              <dt>כוונה</dt>
              <dd dir="ltr">{response.routing.intent_key}</dd>
            </div>
            <div>
              <dt>רמת סיכון</dt>
              <dd>
                <span className={`live-lab-risk live-lab-risk--${response.routing.risk_level}`}>
                  {RISK_LABELS[response.routing.risk_level]}
                </span>
              </dd>
            </div>
            <div>
              <dt>נדרש אדם</dt>
              <dd>{response.routing.human_required ? "כן" : "לא"}</dd>
            </div>
          </dl>
          <p className="live-lab-routing-reason">{response.routing.reason_summary}</p>
          {response.routing.evidence_codes.length > 0 && (
            <ul className="live-lab-evidence" aria-label="קודי ראיות">
              {response.routing.evidence_codes.map((code) => (
                <li key={code} dir="ltr">{code}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="live-lab-draft" data-testid="live-lab-draft-response">
        <div className="live-lab-section-title">
          <Send aria-hidden="true" />
          <h4>טיוטת תשובה בעברית</h4>
        </div>
        <p>{response.draft_response.text}</p>
        <div className="live-lab-draft__internal">
          <div>
            <strong>סיכום פנימי</strong>
            <p>{response.draft_response.internal_summary}</p>
          </div>
          <div>
            <strong>השאלה הבאה</strong>
            <p>{response.draft_response.next_question ?? "לא נדרשת שאלה נוספת"}</p>
          </div>
        </div>
      </section>

      <section className="live-lab-safety" aria-labelledby={`live-lab-safety-title-${index}`}>
        <div className="live-lab-section-title">
          <ShieldCheck aria-hidden="true" />
          <h4 id={`live-lab-safety-title-${index}`}>מונה בטיחות קשיח</h4>
        </div>
        <div className="live-lab-safety-grid">
          <div data-testid="live-lab-tools-count">
            <span>{response.safety.tools_executed}</span>
            <small>כלים הופעלו</small>
          </div>
          <div data-testid="live-lab-mutations-count">
            <span>{response.safety.mutations_applied}</span>
            <small>שינויים בוצעו</small>
          </div>
          <div data-testid="live-lab-outbound-count">
            <span>{response.safety.outbound_messages_sent}</span>
            <small>הודעות נשלחו</small>
          </div>
          <div data-testid="live-lab-persistence-count">
            <span>{response.safety.customer_data_persisted ? "כן" : "לא"}</span>
            <small>מידע לקוח נשמר</small>
          </div>
        </div>
      </section>

      <section className="live-lab-telemetry" aria-label="מדדי מודל והרצה">
        <dl>
          <div>
            <dt>ספק</dt>
            <dd dir="ltr">{response.model.provider}</dd>
          </div>
          <div>
            <dt>מודל סיווג</dt>
            <dd dir="ltr">{response.model.classifier_model}</dd>
          </div>
          <div>
            <dt>מודל תשובה</dt>
            <dd dir="ltr">{response.model.responder_model}</dd>
          </div>
          <div>
            <dt>זמן כולל</dt>
            <dd dir="ltr">{numberFormatter.format(response.timing.total_ms)} ms</dd>
          </div>
          <div>
            <dt>Tokens קלט</dt>
            <dd dir="ltr">{numberFormatter.format(response.model.usage.input_tokens)}</dd>
          </div>
          <div>
            <dt>Tokens פלט</dt>
            <dd dir="ltr">{numberFormatter.format(response.model.usage.output_tokens)}</dd>
          </div>
          <div>
            <dt>Tokens סה״כ</dt>
            <dd dir="ltr">{numberFormatter.format(response.model.usage.total_tokens)}</dd>
          </div>
          <div>
            <dt>מזהה הרצה</dt>
            <dd dir="ltr">{response.run_id}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}

export function AdminLiveLab() {
  const [sessionId] = useState(createControlTowerLiveLabSessionId);
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<ControlTowerLiveLabScenarioId | null>(null);
  const [syntheticConfirmed, setSyntheticConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<LiveLabRun[]>([]);

  const selectedScenario = SYNTHETIC_SCENARIOS.find(
    (scenario) => scenario.id === selectedScenarioId,
  );
  const canSubmit = Boolean(selectedScenario) && syntheticConfirmed && !isLoading;

  const submitRun = async () => {
    if (!selectedScenario || !syntheticConfirmed || isLoading) {
      setErrorMessage(
        "כדי להריץ יש לבחור אחד מהתרחישים הסינתטיים הקבועים ולאשר את תנאי השליחה והשמירה אצל הספק.",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await runControlTowerLiveLab(selectedScenario.id, sessionId);
      setHistory((current) => [
        { completedAt: new Date(), scenario: selectedScenario, response },
        ...current,
      ].slice(0, 20));
      setSyntheticConfirmed(false);
    } catch (error) {
      setErrorMessage(
        error instanceof ControlTowerLiveLabError
          ? ERROR_MESSAGES[error.code]
          : "ההרצה נעצרה באופן בטוח. לא נשלחה הודעה ולא בוצע שינוי.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitRun();
  };

  const chooseScenario = (scenario: SyntheticScenario) => {
    setSelectedScenarioId(scenario.id);
    setSyntheticConfirmed(false);
    setErrorMessage(null);
  };

  return (
    <main className="live-lab" dir="rtl" data-testid="admin-live-lab">
      <header className="live-lab-hero">
        <div className="live-lab-hero__icon" aria-hidden="true">
          <FlaskConical />
        </div>
        <div>
          <span className="live-lab-eyebrow">אב־טיפוס סינתטי — staging בלבד</span>
          <h1>מעבדת Live פנימית</h1>
          <p>
            בדיקת מודל אמיתית של סיווג, ניתוב וטיוטת תשובה — ללא שליחת הודעות, הפעלת
            כלים, פעולות בחשבון או במכשיר, שינוי נתונים או שמירת תוכן לקוח.
          </p>
        </div>
      </header>

      <aside className="live-lab-guardrail" aria-label="מגבלות סביבת הבדיקה">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Live במודל, Shadow בכל פעולה — staging בלבד</strong>
          <p>
            זהו אב־טיפוס סינתטי: המודל פועל בפועל, אך כל תוצאה היא טיוטה פנימית בלבד.
            היא אינה נשלחת ללקוח ואינה מפעילה פעולה בחשבון או במכשיר.
          </p>
        </div>
        <span className="live-lab-status"><CheckCircle2 aria-hidden="true" /> ללא פעולה מול לקוח או מכשיר</span>
      </aside>

      <div className="live-lab-workspace">
        <form className="live-lab-composer" onSubmit={handleSubmit} noValidate>
          <div className="live-lab-composer__heading">
            <div>
              <span className="live-lab-step">2</span>
              <h2>אישור והרצת התרחיש</h2>
            </div>
          </div>

          <section
            className="live-lab-selected-scenario"
            aria-live="polite"
            data-testid="live-lab-selected-scenario"
          >
            {selectedScenario ? (
              <>
                <span>{selectedScenario.category}</span>
                <strong>{selectedScenario.title}</strong>
                <p data-testid="live-lab-selected-scenario-text">{selectedScenario.canonicalText}</p>
                <small dir="ltr">scenario_id: {selectedScenario.id}</small>
              </>
            ) : (
              <>
                <strong>עדיין לא נבחר תרחיש</strong>
                <p>יש לבחור אחד משמונת התרחישים הסינתטיים הקבועים. הזנת טקסט חופשי חסומה.</p>
              </>
            )}
          </section>

          <div className="live-lab-provider-disclosure" id="live-lab-provider-disclosure">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>חשיפת מידע ומדיניות שמירה אצל הספק</strong>
              <p>
                הטקסט הסינתטי הקבוע שנבחר יישלח ל־OpenAI. ברירת המחדל היא שלא נעשה בו
                שימוש לאימון, אך כל עוד הסביבה אינה מאושרת ל־ZDR, יומני abuse monitoring
                של הספק עשויים לכלול את ה־prompt והתשובה ולהישמר עד 30 יום.
              </p>
              <p>
                Kippy אינה שומרת היסטוריית הרצות בצד השרת. ההיסטוריה במסך נשמרת בזיכרון
                בלבד ונמחקת ברענון. טקסט מותאם אישית ונתונים אמיתיים חסומים עד להשלמת שער
                ZDR והפרטיות.
              </p>
            </div>
          </div>

          <div className="live-lab-confirmation">
            <Checkbox
              id="live-lab-synthetic-confirmation"
              data-testid="live-lab-synthetic-confirmation"
              checked={syntheticConfirmed}
              onCheckedChange={(checked) => setSyntheticConfirmed(checked === true)}
              disabled={isLoading}
              aria-describedby="live-lab-provider-disclosure live-lab-synthetic-help"
            />
            <label htmlFor="live-lab-synthetic-confirmation">
              אני מאשר/ת לשלוח ל־OpenAI רק את התרחיש הסינתטי הקבוע שבחרתי, ומבין/ה כי
              יומני הספק עשויים לשמור את ה־prompt והתשובה עד 30 יום בסביבה הנוכחית.
            </label>
          </div>
          <p id="live-lab-synthetic-help" className="live-lab-privacy-note">
            האישור נדרש מחדש אחרי כל בחירת תרחיש ואחרי כל הרצה.
          </p>

          {errorMessage && (
            <div className="live-lab-error" role="alert" data-testid="live-lab-error">
              <AlertTriangle aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            className="live-lab-submit"
            disabled={!canSubmit}
            data-testid="live-lab-submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="live-lab-spinner" aria-hidden="true" />
                מריץ מודל בצורה בטוחה…
              </>
            ) : (
              <>
                <FlaskConical aria-hidden="true" />
                הרצת התרחיש הקבוע
              </>
            )}
          </button>
          <span className="sr-only" role="status" aria-live="polite" data-testid="live-lab-status">
            {isLoading ? "הבדיקה פועלת" : history.length > 0 ? "הבדיקה הסתיימה" : ""}
          </span>
        </form>

        <aside className="live-lab-scenarios" aria-labelledby="live-lab-scenarios-title">
          <div className="live-lab-scenarios__heading">
            <span className="live-lab-step">1</span>
            <div>
              <h2 id="live-lab-scenarios-title">בחירת תרחיש סינתטי קבוע</h2>
              <p>אפשר לבחור רק preset מאושר. הבחירה אינה מפעילה את המודל.</p>
            </div>
          </div>
          <div className="live-lab-scenario-list">
            {SYNTHETIC_SCENARIOS.map((scenario) => (
              <button
                type="button"
                key={scenario.id}
                className="live-lab-scenario"
                onClick={() => chooseScenario(scenario)}
                disabled={isLoading}
                aria-pressed={selectedScenarioId === scenario.id}
                data-testid={`live-lab-scenario-${scenario.id}`}
              >
                <span>{scenario.category}</span>
                <strong>{scenario.title}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="live-lab-history" aria-labelledby="live-lab-history-title" data-testid="live-lab-history">
        <div className="live-lab-history__heading">
          <div>
            <History aria-hidden="true" />
            <h2 id="live-lab-history-title">היסטוריית ההרצות בסשן</h2>
          </div>
          <span>{history.length} / 20</span>
        </div>

        {history.length === 0 ? (
          <div className="live-lab-empty" data-testid="live-lab-empty-history">
            <UserRoundCheck aria-hidden="true" />
            <h3>עדיין לא בוצעה הרצה</h3>
            <p>בחרו תרחיש סינתטי קבוע ואשרו את תנאי הספק. התוצאה תישמר בזיכרון המסך בלבד.</p>
          </div>
        ) : (
          <div className="live-lab-history__list">
            {history.map((run, index) => (
              <LiveLabResult key={`${run.response.run_id}-${run.completedAt.toISOString()}`} run={run} index={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminLiveLab;

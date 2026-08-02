import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useControlTower } from "../context/ControlTowerContext";
import {
  createExecutiveAssistantRepository,
  type CeoChangeTask,
  type ExecutiveBriefing,
} from "../data/executive/ExecutiveAssistantRepository";
import { ControlTowerHeader } from "../components/ControlTowerHeader";

const stateLabels: Record<CeoChangeTask["status"], string> = {
  draft: "טיוטה",
  proposed: "ממתינה לאישור",
  approved: "מאושרת וממתינה ל־runner",
  claimed: "נאספה",
  running: "בביצוע",
  validation_failed: "הבדיקות נכשלו",
  ready_for_review: "מוכנה לבדיקה",
  completed: "הושלמה",
  failed: "נכשלה",
  cancelled: "בוטלה",
};

export function CeoAssistantPage() {
  const { access } = useControlTower();
  const repository = useMemo(() => createExecutiveAssistantRepository(), []);
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [tasks, setTasks] = useState<readonly CeoChangeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [paths, setPaths] = useState("src");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const session = access?.kind === "GRANTED" ? access.session : null;
  const isCeo = Boolean(session?.roles.includes("CEO") && session.assurance === "AAL2");

  const refresh = useCallback(async () => {
    if (!isCeo) return;
    setLoading(true);
    setError(null);
    const [briefingResult, tasksResult] = await Promise.all([
      repository.getBriefing(),
      repository.listChangeTasks(),
    ]);
    if (briefingResult.ok === false) setError(briefingResult.error.safeMessage);
    else setBriefing(briefingResult.data);
    if (tasksResult.ok === false) setError((current) => current ?? tasksResult.error.safeMessage);
    else setTasks(tasksResult.data);
    setLoading(false);
  }, [isCeo, repository]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function propose(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const allowedPathScopes = paths.split(",").map((value) => value.trim()).filter(Boolean);
    if (!title.trim() || !objective.trim() || allowedPathScopes.length === 0) {
      setNotice("יש למלא כותרת, מטרה ותחום קבצים.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await repository.proposeChangeTask({
      idempotencyKey: `ceo.${crypto.randomUUID()}`,
      title: title.trim(),
      objectiveSummary: objective.trim(),
      repositoryKey: "kippy",
      allowedPathScopes,
      requiredCheckCodes: ["lint", "typecheck", "targeted_tests"],
      aggregateContextRefs: [],
    });
    if (result.ok === false) setNotice(result.error.safeMessage);
    else {
      setNotice("הצעת השינוי נשמרה וממתינה לאישור. דבר לא הורץ בקוד.");
      setTitle("");
      setObjective("");
      await refresh();
    }
    setBusy(false);
  }

  async function approve(taskId: string) {
    if (busy) return;
    setBusy(true);
    const result = await repository.approveChangeTask(taskId);
    if (result.ok === false) {
      setNotice(result.error.safeMessage);
    } else {
      setNotice("המשימה אושרה. היא עדיין ממתינה ל־runner חיצוני ומהימן.");
    }
    await refresh();
    setBusy(false);
  }

  if (!session) return null;
  if (!isCeo) {
    return (
      <div className="ct-ceo-page">
        <ControlTowerHeader session={session} />
        <main className="ct-ceo-denied" data-testid="ceo-assistant-denied">
          <ShieldCheck size={28} aria-hidden="true" />
          <h2>העוזרת הפרטית זמינה למנכ״ל בלבד</h2>
          <p>נדרשים תפקיד CEO וסשן AAL2 פעיל.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="ct-ceo-page" data-testid="ceo-assistant-page">
      <ControlTowerHeader session={session} />
      <main className="ct-ceo-main">
        <div className="ct-ceo-title-row">
          <div>
            <p className="ct-eyebrow">CEO Private</p>
            <h2><Bot size={24} aria-hidden="true" /> העוזרת האישית שלך</h2>
            <p>סיכומים מצרפיים והצעות שינוי בלבד. אין ערוץ לקוחות ואין גישה לתוכן גולמי של ילדים.</p>
          </div>
          <div className="ct-ceo-title-actions">
            <Link className="ct-button ct-button-secondary" to="/control-tower/inbox"><ArrowRight size={16} /> חזרה לאופרציה</Link>
            <button type="button" className="ct-button ct-button-secondary" onClick={() => void refresh()} disabled={loading}>
              <RefreshCcw size={16} /> רענון
            </button>
          </div>
        </div>

        {error ? <div className="ct-inline-alert" role="alert">{error}</div> : null}
        {loading ? <div className="ct-pane-state" role="status">טוענים תמונת מצב ניהולית…</div> : null}

        {briefing ? (
          <section className="ct-ceo-section" aria-labelledby="ceo-briefing-title">
            <h3 id="ceo-briefing-title">תמונת מצב</h3>
            <div className="ct-ceo-metrics">
              <Metric label="ילדים עם בקרת הורים" value={briefing.parentalControls.configuredChildren} />
              <Metric label="לוחות זמנים פעילים" value={briefing.parentalControls.activeSchedules} />
              <Metric label="Geofences פעילים" value={briefing.parentalControls.activeGeofences} />
              <Metric label="ניסיונות חסימה ב־24 שעות" value={briefing.parentalControls.blockedAttemptsLast24h} />
              <Metric label="ריצות סוכנים ב־24 שעות" value={briefing.agentRuntime.runsLast24h} />
              <Metric label="Fail-closed ב־24 שעות" value={briefing.agentRuntime.failedClosedLast24h} />
            </div>
            <div className={`ct-ceo-runner ct-ceo-runner-${briefing.runnerState}`} role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>Codex runner: {briefing.runnerState}</strong>
                <span>גם לאחר אישור, הביצוע יתחיל רק דרך host חיצוני, worktree מבודד, בדיקות ו־PR אנושי.</span>
              </div>
            </div>
          </section>
        ) : null}

        <section className="ct-ceo-section" aria-labelledby="ceo-task-title">
          <h3 id="ceo-task-title">הצעת משימת תיקון ל־Codex</h3>
          <form className="ct-ceo-task-form" onSubmit={propose}>
            <label>כותרת<input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>מטרת השינוי<textarea value={objective} maxLength={2000} rows={4} onChange={(event) => setObjective(event.target.value)} /></label>
            <label>תחומי קבצים, מופרדים בפסיק<input value={paths} onChange={(event) => setPaths(event.target.value)} /></label>
            <p className="ct-ceo-safety-note">אין להדביק כאן הודעות, תמלולים או מידע אישי של ילד. ההקשר ל־runner מוגבל לקוד ולנתונים תפעוליים מצרפיים.</p>
            <button className="ct-button ct-button-primary" type="submit" disabled={busy}>שמירת הצעה לאישור</button>
          </form>
          {notice ? <div className="ct-ceo-notice" role="status">{notice}</div> : null}
        </section>

        <section className="ct-ceo-section" aria-labelledby="ceo-queue-title">
          <h3 id="ceo-queue-title">תור משימות</h3>
          {tasks.length === 0 ? <p>אין משימות בתור.</p> : (
            <ul className="ct-ceo-task-list">
              {tasks.map((task) => (
                <li key={task.taskId}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{stateLabels[task.status]} · runner: {task.runnerState}</span>
                    <p>{task.objectiveSummary}</p>
                    <small>{task.allowedPathScopes.join(" · ")}</small>
                  </div>
                  {task.status === "proposed" ? (
                    <button type="button" className="ct-button ct-button-primary" disabled={busy} onClick={() => void approve(task.taskId)}>
                      <CheckCircle2 size={16} /> אישור לביצוע מבוקר
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="ct-ceo-metric"><strong>{value}</strong><span>{label}</span></div>;
}

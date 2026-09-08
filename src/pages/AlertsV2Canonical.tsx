import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getV2GuardianAlerts, type V2GuardianAlert, type V2GuardianIncidentState } from "@/lib/v2/guardianAlertsService";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { V2GuardianCaseDetails } from "@/components/alerts/V2GuardianCaseDetails";
import { V2MissedConcern } from "@/components/alerts/V2MissedConcern";
import {
  acknowledgementLabel, caseTitle, currentCaseLabel, formatCaseTime, platformLabel, severityClasses,
} from "@/components/alerts/guardianCasePresentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const tabLabels: Array<{ state: V2GuardianIncidentState; label: string }> = [
  { state: "new", label: "חדשות" }, { state: "saved", label: "שמורות" }, { state: "acknowledged", label: "טופלו" },
];

export default function AlertsV2Canonical() {
  const { familyId, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const incidentId = searchParams.get("incident");
  const [children, setChildren] = useState<Array<{ id: string; displayName: string }>>([]);
  const [alerts, setAlerts] = useState<V2GuardianAlert[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<V2GuardianIncidentState>("new");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadGeneration = useRef(0);
  const active = useRef(false);
  const currentLoad = useRef<(() => Promise<void>) | null>(null);
  const lastRefresh = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openButtons = useRef(new Map<string, HTMLButtonElement>());
  const tabButtons = useRef(new Map<V2GuardianIncidentState, HTMLButtonElement>());
  const returnFocusId = useRef<string | null>(null);
  const returnScroll = useRef(0);
  const previousIncident = useRef(incidentId);
  const pendingFocusReturn = useRef(false);

  const load = useCallback(async () => {
    if (!active.current) return;
    const generation = ++loadGeneration.current;
    lastRefresh.current = Date.now();
    if (!familyId || !user?.id) {
      setChildren([]); setAlerts([]); setLoading(false); setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setLoadError(false);
    try {
      const result = await getV2GuardianAlerts({ familyId, childId: selectedChildId });
      if (generation !== loadGeneration.current) return;
      setChildren(result.children);
      setAlerts(result.alerts);
    } catch {
      if (generation === loadGeneration.current) setLoadError(true);
    } finally {
      if (generation === loadGeneration.current) { setLoading(false); setRefreshing(false); }
    }
  }, [familyId, selectedChildId, user?.id]);
  currentLoad.current = load;
  const refreshCurrentList = useCallback(async () => { await currentLoad.current?.(); }, []);

  useEffect(() => {
    active.current = true;
    setLoading(true);
    setAlerts([]);
    void load();
    return () => { active.current = false; loadGeneration.current += 1; };
  }, [load]);

  useEffect(() => {
    if (incidentId !== null) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 1_000) void load();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [incidentId, load]);

  useEffect(() => {
    if (previousIncident.current !== null && incidentId === null) pendingFocusReturn.current = true;
    previousIncident.current = incidentId;
    if (incidentId !== null || loading || !pendingFocusReturn.current) return;
    const frame = requestAnimationFrame(() => {
      const button = returnFocusId.current ? openButtons.current.get(returnFocusId.current) : undefined;
      (button ?? tabButtons.current.get(activeTab) ?? headingRef.current)?.focus({ preventScroll: true });
      window.scrollTo({ top: returnScroll.current, behavior: "auto" });
      pendingFocusReturn.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [incidentId, loading, activeTab]);

  const counts = useMemo(() => ({
    new: alerts.filter((alert) => alert.state === "new").length,
    saved: alerts.filter((alert) => alert.state === "saved").length,
    acknowledged: alerts.filter((alert) => alert.state === "acknowledged").length,
  }), [alerts]);
  const visibleAlerts = alerts.filter((alert) => alert.state === activeTab);

  const openCase = (id: string) => {
    returnFocusId.current = id;
    returnScroll.current = window.scrollY;
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set("incident", id); return next; });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const closeCase = () => {
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("incident"); return next; }, { replace: true });
  };

  return (
    <div className="v2-dark min-h-screen bg-background pb-24 text-foreground" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto min-w-0 max-w-2xl space-y-5 px-4 py-6">
        {incidentId !== null ? familyId && user?.id ? (
          <V2GuardianCaseDetails key={`${familyId}:${user.id}:${incidentId}`} familyId={familyId} userId={user.id}
            incidentId={incidentId} onBack={closeCase} onChanged={refreshCurrentList} />
        ) : <div role="status" className="space-y-3 rounded-xl border border-border bg-card p-5"><p>יש להתחבר לחשבון המשפחה כדי לצפות באירוע.</p><Button variant="outline" className="min-h-11" onClick={closeCase}>חזרה להתראות</Button></div> : <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">התראות בטיחות</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">העדכונים האחרונים באירועים שדורשים את תשומת לבך</p>
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="רענון ההתראות" onClick={() => void load()} disabled={refreshing}>
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} />
            </Button>
          </div>
          {children.length > 1 && <select aria-label="סינון התראות לפי ילד/ה" value={selectedChildId ?? ""}
            onChange={(event) => setSelectedChildId(event.target.value || null)}
            className="min-h-11 w-full min-w-0 rounded-xl border border-border/50 bg-card p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <option value="">כל הילדים</option>{children.map((child) => <option key={child.id} value={child.id}>{child.displayName}</option>)}
          </select>}
          <div className="grid grid-cols-3 gap-2" aria-label="סינון לפי מצב ההתראה">
            {tabLabels.map((tab) => <button type="button" key={tab.state}
              ref={(node) => { if (node) tabButtons.current.set(tab.state, node); else tabButtons.current.delete(tab.state); }}
              onClick={() => setActiveTab(tab.state)} aria-pressed={activeTab === tab.state}
              className={`min-h-11 rounded-xl border p-3 text-center transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${activeTab === tab.state ? "border-primary/50 bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground"}`}>
              <span className="block text-xl font-bold">{counts[tab.state]}</span><span className="block text-xs">{tab.label}</span>
            </button>)}
          </div>
          {loading ? <div role="status" className="flex items-center justify-center gap-3 py-16"><Loader2 aria-hidden="true" className="h-7 w-7 motion-safe:animate-spin text-primary" /><span className="text-sm text-muted-foreground">טוען התראות…</span></div>
            : loadError ? <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5"><p className="text-sm">לא ניתן לטעון את ההתראות כרגע.</p><Button variant="outline" className="min-h-11" onClick={() => void load()}>ניסיון נוסף</Button></div>
            : visibleAlerts.length === 0 ? <Card className="border-dashed border-border bg-card"><CardContent className="py-14 text-center">
              <CheckCircle2 aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-success" />
              <p className="font-semibold">{activeTab === "new" ? "אין התראות חדשות" : activeTab === "saved" ? "לא נשמרו התראות" : "אין התראות שסומנו כטופלו"}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">היעדר התראה לא אומר שאין סיבה לדאגה. אפשר לדווח למטה על חשש שלא הופיע.</p>
            </CardContent></Card>
            : <div className="space-y-4">
              {visibleAlerts.map((alert) => {
                const acknowledgement = acknowledgementLabel(alert);
                const newAttention = alert.state === "new" && (alert.attentionAssessmentSeq ?? 0) > (alert.acknowledgedAssessmentSeq ?? 0);
                return <Card key={alert.id} className="min-w-0 border-border bg-card" data-testid={`incident-${alert.id}`}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"><ShieldAlert aria-hidden="true" className="h-5 w-5 text-destructive" /></div>
                        <div className="min-w-0"><h2 className="break-words font-semibold">{caseTitle(alert)}</h2><p className="break-words text-xs text-muted-foreground">{alert.childName} · <bdi>{platformLabel(alert.sourcePlatform)}</bdi></p></div>
                      </div>
                      <Badge variant="outline" className={`max-w-full whitespace-normal text-start leading-relaxed ${alert.assessmentSource === "expert" && alert.severity ? severityClasses[alert.severity] ?? "border-border text-muted-foreground" : "border-border text-muted-foreground"}`}>{currentCaseLabel(alert)}</Badge>
                    </div>
                    <p className="break-words text-sm font-medium leading-relaxed">{alert.summary}</p>
                    <div className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                      <p className="flex flex-wrap items-center gap-1"><Clock3 aria-hidden="true" className="h-3 w-3 shrink-0" />{alert.latestAssessmentAt ? "בדיקה אחרונה:" : "מועד האירוע המקורי:"} <time dateTime={alert.latestAssessmentAt ?? alert.occurredAt}>{formatCaseTime(alert.latestAssessmentAt ?? alert.occurredAt)}</time></p>
                      {acknowledgement && <p>{acknowledgement}</p>}
                      {newAttention && <p className="text-primary">עדכון חדש שמצריך תשומת לב</p>}
                    </div>
                    <Button className="min-h-11 w-full whitespace-normal" data-testid={`open-incident-${alert.id}`}
                      ref={(node) => { if (node) openButtons.current.set(alert.id, node); else openButtons.current.delete(alert.id); }}
                      onClick={() => openCase(alert.id)}>פתיחת האירוע</Button>
                  </CardContent>
                </Card>;
              })}
            </div>}
          {!loading && !loadError && <V2MissedConcern key={familyId} children={children} />}
        </>}
      </main>
      <BottomNavigationV2 />
    </div>
  );
}

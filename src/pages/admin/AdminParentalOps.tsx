import { useEffect, useState } from "react";
import { adminSupabase } from "@/integrations/supabase/admin-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Clock, MapPin, Smartphone, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

type Row = Record<string, any>;

export function AdminParentalOps() {
  const [tab, setTab] = useState("chores");
  const [loading, setLoading] = useState(true);
  const [chores, setChores] = useState<Row[]>([]);
  const [bank, setBank] = useState<Row[]>([]);
  const [transactions, setTransactions] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [bonusGrants, setBonusGrants] = useState<Row[]>([]);
  const [places, setPlaces] = useState<Row[]>([]);
  const [devices, setDevices] = useState<Row[]>([]);
  const [childrenMap, setChildrenMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [
        choresRes,
        bankRes,
        txRes,
        reqRes,
        bonusRes,
        placesRes,
        devicesRes,
        childrenRes,
      ] = await Promise.all([
        adminSupabase.from("chores").select("*").order("created_at", { ascending: false }).limit(200),
        adminSupabase.from("reward_bank").select("*").order("balance_minutes", { ascending: false }).limit(200),
        adminSupabase.from("reward_transactions").select("*").gte("created_at", todayIso).order("created_at", { ascending: false }).limit(200),
        adminSupabase.from("time_extension_requests").select("*").order("created_at", { ascending: false }).limit(100),
        adminSupabase.from("bonus_time_grants").select("*").gte("created_at", todayIso).order("created_at", { ascending: false }).limit(100),
        adminSupabase.from("child_places").select("*").order("created_at", { ascending: false }).limit(200),
        adminSupabase.from("devices").select("*").order("last_seen", { ascending: false, nullsFirst: false }).limit(300),
        adminSupabase.from("children").select("id, name"),
      ]);
      setChores(choresRes.data || []);
      setBank(bankRes.data || []);
      setTransactions(txRes.data || []);
      setRequests(reqRes.data || []);
      setBonusGrants(bonusRes.data || []);
      setPlaces(placesRes.data || []);
      setDevices(devicesRes.data || []);
      const m = new Map<string, string>();
      (childrenRes.data || []).forEach((c: any) => m.set(c.id, c.name));
      setChildrenMap(m);
      setLoading(false);
    };
    load();
  }, []);

  const childName = (id?: string | null) => (id ? childrenMap.get(id) || id.slice(0, 8) : "—");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const choresPending = chores.filter((c) => c.status === "completed_by_child").length;
  const choresActive = chores.filter((c) => c.status === "pending").length;
  const choresApproved = chores.filter((c) => c.status === "approved").length;
  const totalBank = bank.reduce((s, b) => s + (b.balance_minutes || 0), 0);
  const redemptionsToday = transactions.filter((t) => t.amount_minutes < 0).length;
  const requestsPending = requests.filter((r) => r.status === "pending").length;

  const now = Date.now();
  const onlineDevices = devices.filter((d) => d.last_seen && now - new Date(d.last_seen).getTime() < 15 * 60 * 1000);
  const todayDevices = devices.filter((d) => d.last_seen && now - new Date(d.last_seen).getTime() < 24 * 60 * 60 * 1000 && now - new Date(d.last_seen).getTime() >= 15 * 60 * 1000);
  const offlineDevices = devices.filter((d) => !d.last_seen || now - new Date(d.last_seen).getTime() >= 24 * 60 * 60 * 1000);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
        <TabsTrigger value="chores" className="gap-2"><ListChecks className="w-4 h-4" /><span className="hidden sm:inline">משימות ובנק</span></TabsTrigger>
        <TabsTrigger value="time" className="gap-2"><Clock className="w-4 h-4" /><span className="hidden sm:inline">זמן מסך ובונוסים</span></TabsTrigger>
        <TabsTrigger value="places" className="gap-2"><MapPin className="w-4 h-4" /><span className="hidden sm:inline">גבולות גזרה</span></TabsTrigger>
        <TabsTrigger value="devices" className="gap-2"><Smartphone className="w-4 h-4" /><span className="hidden sm:inline">מכשירים</span></TabsTrigger>
      </TabsList>

      {/* CHORES + REWARD BANK */}
      <TabsContent value="chores" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="משימות פעילות" value={choresActive} />
          <KpiCard label="ממתינות לאישור" value={choresPending} accent="amber" />
          <KpiCard label="אושרו" value={choresApproved} accent="emerald" />
          <KpiCard label="סה״כ דקות בבנק" value={totalBank} accent="yellow" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">בנק תגמולים – יתרות לכל ילד</CardTitle></CardHeader>
          <CardContent>
            {bank.length === 0 ? <Empty text="אין יתרות" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-right py-2">ילד</th><th className="text-right">יתרה (דק׳)</th><th className="text-right">רצף</th><th className="text-right">עדכון</th></tr>
                  </thead>
                  <tbody>
                    {bank.slice(0, 50).map((b) => (
                      <tr key={b.id} className="border-t border-border/40">
                        <td className="py-2">{childName(b.child_id)}</td>
                        <td>{b.balance_minutes}</td>
                        <td>{b.current_streak ?? 0}</td>
                        <td className="text-muted-foreground text-xs">{b.updated_at ? formatDistanceToNow(new Date(b.updated_at), { addSuffix: true, locale: he }) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">משימות אחרונות (200)</CardTitle></CardHeader>
          <CardContent>
            {chores.length === 0 ? <Empty text="אין משימות" /> : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr><th className="text-right py-2">כותרת</th><th className="text-right">ילד</th><th className="text-right">דקות</th><th className="text-right">סטטוס</th><th className="text-right">נוצר</th></tr>
                  </thead>
                  <tbody>
                    {chores.slice(0, 100).map((c) => (
                      <tr key={c.id} className="border-t border-border/40">
                        <td className="py-2">{c.title}</td>
                        <td>{childName(c.child_id)}</td>
                        <td>{c.reward_minutes}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td className="text-muted-foreground text-xs">{format(new Date(c.created_at), "dd/MM HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">תנועות בנק היום ({transactions.length})</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? <Empty text="אין תנועות היום" /> : (
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr><th className="text-right py-2">ילד</th><th className="text-right">סכום</th><th className="text-right">מקור</th><th className="text-right">זמן</th></tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-t border-border/40">
                        <td className="py-2">{childName(t.child_id)}</td>
                        <td className={t.amount_minutes < 0 ? "text-rose-500" : "text-emerald-500"}>{t.amount_minutes > 0 ? "+" : ""}{t.amount_minutes}</td>
                        <td>{t.source}</td>
                        <td className="text-muted-foreground text-xs">{format(new Date(t.created_at), "HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* TIME / BONUS */}
      <TabsContent value="time" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="בקשות הארכה ממתינות" value={requestsPending} accent="orange" />
          <KpiCard label="בונוסים היום" value={bonusGrants.length} accent="amber" />
          <KpiCard label="פדיונות מבנק היום" value={redemptionsToday} accent="rose" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">בקשות הארכת זמן (100 אחרונות)</CardTitle></CardHeader>
          <CardContent>
            {requests.length === 0 ? <Empty text="אין בקשות" /> : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr><th className="text-right py-2">ילד</th><th className="text-right">בקשה (דק׳)</th><th className="text-right">אושרו</th><th className="text-right">סטטוס</th><th className="text-right">סיבה</th><th className="text-right">נוצר</th></tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id} className="border-t border-border/40">
                        <td className="py-2">{childName(r.child_id)}</td>
                        <td>{r.requested_minutes}</td>
                        <td>{r.approved_minutes ?? "—"}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td className="text-muted-foreground text-xs max-w-[200px] truncate">{r.reason || "—"}</td>
                        <td className="text-muted-foreground text-xs">{format(new Date(r.created_at), "dd/MM HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">בונוסים שהוענקו היום</CardTitle></CardHeader>
          <CardContent>
            {bonusGrants.length === 0 ? <Empty text="לא הוענקו בונוסים היום" /> : (
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr><th className="text-right py-2">ילד</th><th className="text-right">דקות</th><th className="text-right">תאריך תוקף</th><th className="text-right">נוצר</th></tr>
                  </thead>
                  <tbody>
                    {bonusGrants.map((g) => (
                      <tr key={g.id} className="border-t border-border/40">
                        <td className="py-2">{childName(g.child_id)}</td>
                        <td>+{g.bonus_minutes}</td>
                        <td>{g.grant_date}</td>
                        <td className="text-muted-foreground text-xs">{format(new Date(g.created_at), "HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* PLACES */}
      <TabsContent value="places" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="סה״כ מקומות" value={places.length} accent="rose" />
          <KpiCard label="ילדים עם מקומות" value={new Set(places.map((p) => p.child_id)).size} accent="emerald" />
          <KpiCard label="פעילים" value={places.filter((p) => p.is_active).length} accent="cyan" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">גבולות גזרה במערכת (200 אחרונים)</CardTitle></CardHeader>
          <CardContent>
            {places.length === 0 ? <Empty text="לא הוגדרו מקומות" /> : (
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr><th className="text-right py-2">ילד</th><th className="text-right">סוג</th><th className="text-right">תווית</th><th className="text-right">רדיוס</th><th className="text-right">פעיל</th><th className="text-right">נוצר</th></tr>
                  </thead>
                  <tbody>
                    {places.map((p) => (
                      <tr key={p.id} className="border-t border-border/40">
                        <td className="py-2">{childName(p.child_id)}</td>
                        <td>{p.place_type}</td>
                        <td>{p.label || "—"}</td>
                        <td>{p.radius_meters}מ׳</td>
                        <td>{p.is_active ? <Badge variant="default" className="bg-emerald-500/15 text-emerald-600">פעיל</Badge> : <Badge variant="outline">כבוי</Badge>}</td>
                        <td className="text-muted-foreground text-xs">{format(new Date(p.created_at), "dd/MM/yy")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* DEVICES */}
      <TabsContent value="devices" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Online (≤15 דק׳)" value={onlineDevices.length} accent="emerald" />
          <KpiCard label="היום" value={todayDevices.length} accent="cyan" />
          <KpiCard label="Offline (>24ש)" value={offlineDevices.length} accent="rose" />
          <KpiCard label="סה״כ מכשירים" value={devices.length} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">מכשירים (300 אחרונים)</CardTitle></CardHeader>
          <CardContent>
            {devices.length === 0 ? <Empty text="אין מכשירים" /> : (
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground sticky top-0 bg-card">
                    <tr><th className="text-right py-2">Device ID</th><th className="text-right">ילד</th><th className="text-right">סוללה</th><th className="text-right">נראה לאחרונה</th></tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => {
                      const status = !d.last_seen ? "offline" :
                        now - new Date(d.last_seen).getTime() < 15 * 60 * 1000 ? "online" :
                        now - new Date(d.last_seen).getTime() < 24 * 60 * 60 * 1000 ? "today" : "offline";
                      return (
                        <tr key={d.device_id} className="border-t border-border/40">
                          <td className="py-2 font-mono text-xs">{d.device_id?.slice(0, 12)}…</td>
                          <td>{childName(d.child_id)}</td>
                          <td>{d.battery_level != null ? `${d.battery_level}%` : "—"}</td>
                          <td>
                            <span className={
                              status === "online" ? "text-emerald-500" :
                              status === "today" ? "text-cyan-500" : "text-rose-500"
                            }>
                              {d.last_seen ? formatDistanceToNow(new Date(d.last_seen), { addSuffix: true, locale: he }) : "מעולם לא"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-500 border-emerald-500/20",
    amber: "text-amber-500 border-amber-500/20",
    yellow: "text-yellow-500 border-yellow-500/20",
    orange: "text-orange-500 border-orange-500/20",
    rose: "text-rose-500 border-rose-500/20",
    cyan: "text-cyan-500 border-cyan-500/20",
  };
  const cls = accent ? colorMap[accent] : "text-primary border-primary/20";
  return (
    <Card className={cls.split(" ").filter((c) => c.startsWith("border")).join(" ")}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${cls.split(" ").filter((c) => c.startsWith("text")).join(" ")}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "ממתין", cls: "bg-muted text-muted-foreground" },
    completed_by_child: { label: "סומן ע״י ילד", cls: "bg-amber-500/15 text-amber-600" },
    approved: { label: "אושר", cls: "bg-emerald-500/15 text-emerald-600" },
    rejected: { label: "נדחה", cls: "bg-rose-500/15 text-rose-600" },
    granted: { label: "אושר", cls: "bg-emerald-500/15 text-emerald-600" },
    denied: { label: "נדחה", cls: "bg-rose-500/15 text-rose-600" },
  };
  const v = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-muted-foreground py-8 text-sm">{text}</p>;
}

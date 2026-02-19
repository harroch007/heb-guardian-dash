import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Users, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { useState } from "react";

interface TrainingStats {
  total: number;
  systemAlertCount: number;
  byGender: { name: string; value: number }[];
  byAge: { age: string; count: number }[];
  byVerdict: { name: string; value: number; color: string }[];
  byRiskLevel: { level: string; count: number }[];
  classificationCounts: { name: string; count: number }[];
}

interface TrainingRecord {
  id: string;
  alert_id: number | null;
  raw_text: string;
  age_at_incident: number | null;
  gender: string | null;
  ai_verdict: {
    verdict?: string;
    risk_score?: number;
  } | null;
  created_at: string;
}

interface AdminTrainingProps {
  stats: TrainingStats | null;
  records: TrainingRecord[];
  loading: boolean;
}

const VERDICT_BADGE: Record<string, string> = {
  safe: "bg-green-500/10 text-green-500 border-green-500/20",
  monitor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  notify: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function AdminTraining({ stats, records, loading }: AdminTrainingProps) {
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען נתוני אימון...</div>
      </div>
    );
  }

  // Records already come sorted and limited to 100 from DB
  const displayRecords = records;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              סה"כ רשומות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.total || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              התפלגות מגדר
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {stats?.byGender.map((g) => (
              <Badge key={g.name} variant="secondary">
                {g.name}: {g.value}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ממוצע גילאים
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {stats?.byAge.slice(0, 3).map((a) => (
              <Badge key={a.age} variant="outline">
                {a.age}: {a.count}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              סוגי סיכון
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {stats?.classificationCounts.slice(0, 3).map((c) => (
              <Badge key={c.name} variant="destructive">
                {c.name}: {c.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* System Alerts Card */}
      {(stats?.systemAlertCount ?? 0) > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {stats?.systemAlertCount} התראות מערכת (מכשיר לא מגיב) נמצאו בנתוני האימון
              </p>
              <p className="text-xs text-muted-foreground">
                רשומות אלו סוננו מהטבלה כי הן אינן רשומות אימון אמיתיות
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">רשומות אימון</CardTitle>
          <CardDescription>
            100 רשומות אחרונות • {displayRecords.filter(r => r.alert_id).length} עם קישור להתראה
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[80px]">Alert ID</TableHead>
                  <TableHead className="text-right">טקסט (קיצור)</TableHead>
                  <TableHead className="text-right w-[60px]">גיל</TableHead>
                  <TableHead className="text-right w-[60px]">מגדר</TableHead>
                  <TableHead className="text-right w-[80px]">Verdict</TableHead>
                  <TableHead className="text-right w-[60px]">Score</TableHead>
                  <TableHead className="text-right w-[120px]">תאריך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRecords.map((record) => (
                  <TableRow key={record.id} className="cursor-pointer hover:bg-muted/80" onClick={() => setSelectedRecord(record)}>
                    <TableCell>
                      {record.alert_id ? (
                        <a
                          href={`/alerts?highlight=${record.alert_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                        >
                          {record.alert_id}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs" title={record.raw_text}>
                      {record.raw_text.substring(0, 80)}{record.raw_text.length > 80 ? '…' : ''}
                    </TableCell>
                    <TableCell className="text-xs">{record.age_at_incident ?? '—'}</TableCell>
                    <TableCell className="text-xs">{record.gender === 'male' ? 'ז' : record.gender === 'female' ? 'נ' : '—'}</TableCell>
                    <TableCell>
                      {record.ai_verdict?.verdict ? (
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${VERDICT_BADGE[record.ai_verdict.verdict] || ''}`}>
                          {record.ai_verdict.verdict}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{record.ai_verdict?.risk_score ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(record.created_at), 'dd/MM HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2">
              {selectedRecord?.alert_id ? (
                <a
                  href={`/alerts?highlight=${selectedRecord.alert_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Alert #{selectedRecord.alert_id}
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <span>רשומת אימון</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedRecord && format(new Date(selectedRecord.created_at), 'dd/MM/yyyy HH:mm')}
            </DialogDescription>
          </DialogHeader>

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 text-sm">
            {selectedRecord?.age_at_incident != null && (
              <Badge variant="outline">גיל: {selectedRecord.age_at_incident}</Badge>
            )}
            {selectedRecord?.gender && (
              <Badge variant="outline">מגדר: {selectedRecord.gender === 'male' ? 'זכר' : selectedRecord.gender === 'female' ? 'נקבה' : selectedRecord.gender}</Badge>
            )}
            {selectedRecord?.ai_verdict?.verdict && (
              <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${VERDICT_BADGE[selectedRecord.ai_verdict.verdict] || ''}`}>
                {selectedRecord.ai_verdict.verdict}
              </span>
            )}
            {selectedRecord?.ai_verdict?.risk_score != null && (
              <Badge variant="secondary">Risk Score: {selectedRecord.ai_verdict.risk_score}</Badge>
            )}
          </div>

          {/* Full text */}
          <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
            <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-md" dir="rtl">
              {selectedRecord?.raw_text}
            </div>
          </ScrollArea>

          {/* AI Verdict JSON */}
          {selectedRecord?.ai_verdict && Object.keys(selectedRecord.ai_verdict).length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">AI Verdict (JSON)</p>
              <ScrollArea className="max-h-[150px]">
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto" dir="ltr">
                  {JSON.stringify(selectedRecord.ai_verdict, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות לפי Verdict</CardTitle>
            <CardDescription>safe / review / notify / monitor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.byVerdict || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats?.byVerdict.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות לפי גיל</CardTitle>
            <CardDescription>קבוצות גיל של ילדים</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.byAge || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">סוגי סיכון מזוהים</CardTitle>
            <CardDescription>התפלגות לפי סוג איום (ציון מעל 50)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.classificationCounts || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">רמות סיכון</CardTitle>
            <CardDescription>התפלגות לפי Risk Score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {stats?.byRiskLevel.map((level) => (
                <div
                  key={level.level}
                  className={`p-4 rounded-lg text-center ${
                    level.level === "low"
                      ? "bg-green-500/10 border border-green-500/20"
                      : level.level === "medium"
                      ? "bg-yellow-500/10 border border-yellow-500/20"
                      : level.level === "high"
                      ? "bg-orange-500/10 border border-orange-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <p className="text-2xl font-bold">{level.count}</p>
                  <p className="text-sm text-muted-foreground capitalize">{level.level}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

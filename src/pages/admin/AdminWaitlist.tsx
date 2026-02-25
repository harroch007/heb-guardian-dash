import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Search, Smartphone, CheckCircle, Loader2, TrendingUp, MessageSquare, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_MESSAGE_TEMPLATE = `שלום {parent_name}\n\nKippyAI היא אפליקציה שמזהה מצבים כמו בריונות, חרמות, לחץ חברתי או פניות מזרים בשלבים מאוד מוקדמים, כל זאת מבלי לחשוף לך את תוכן ההודעות של הילד.\n\nנרשמת אלינו לפני כמה זמן לרשימת ההמתנה והיום התור שלך הגיע!\n\nכמשתמשים הראשונים, מגיעים לך 3 חודשים ראשונים חינם — ללא כרטיס אשראי.\nקוד ההטבה שלך: KIPPY3\n\nכדי להתחיל:\n1. התחבר/י דרך האימייל שאיתו נרשמת:\nhttps://www.kippyai.com/\n\n2. במכשיר הילד חפשו בחנות האפליקציות: KippyAI\n3. עקבו אחרי שלבי החיבור (זה לוקח כמה דקות)\n\nKippyAI לא מחליפה אותך כהורה, אנחנו פשוט מרימים דגל קטן ובזמן, כדי שתוכל/י להיות שם כשצריך.\n\nאני כאן לכל שאלה.\nיריב הרוש, מנכ"ל KippyAI`;

const STORAGE_KEY = 'kippy_wa_message_template';

interface WaitlistEntry {
  id: string;
  parent_name: string;
  email: string;
  phone: string;
  child_age: number;
  device_os: string;
  region: string | null;
  referral_source: string | null;
  status: string | null;
  created_at: string;
}

interface AdminWaitlistProps {
  entries: WaitlistEntry[];
  loading: boolean;
  onRefresh: () => void;
  funnel?: { stage: string; count: number }[];
}

export function AdminWaitlist({ entries, loading, onRefresh, funnel }: AdminWaitlistProps) {
  const [search, setSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_MESSAGE_TEMPLATE;
  });
  const [editingTemplate, setEditingTemplate] = useState(messageTemplate);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = 
      entry.parent_name.toLowerCase().includes(search.toLowerCase()) ||
      entry.email.toLowerCase().includes(search.toLowerCase()) ||
      entry.phone.includes(search);
    
    const matchesDevice = 
      deviceFilter === "all" || 
      entry.device_os.toLowerCase() === deviceFilter.toLowerCase();

    return matchesSearch && matchesDevice;
  });

  const androidCount = entries.filter(e => e.device_os.toLowerCase().includes('android')).length;
  const iphoneCount = entries.filter(e => e.device_os.toLowerCase().includes('iphone') || e.device_os.toLowerCase().includes('ios')).length;

  const handleApprove = async (entry: WaitlistEntry) => {
    setApprovingId(entry.id);
    try {
      // Add to allowed_emails
      const { error: insertError } = await supabase
        .from('allowed_emails')
        .insert({
          email: entry.email.toLowerCase(),
          added_by: 'admin',
          notes: `Waitlist approval - ${entry.parent_name}`
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast.info(`${entry.email} כבר נמצא ברשימה המורשית`);
        } else {
          throw insertError;
        }
      }

      // Update waitlist status
      const { error: updateError } = await supabase
        .from('waitlist_signups')
        .update({ status: 'approved' })
        .eq('id', entry.id);

      if (updateError) throw updateError;

      // Open WhatsApp with pre-filled message
      const cleanPhone = entry.phone.replace(/[\s\-()]/g, '').replace(/^0/, '972');
      const message = messageTemplate.replace(/\{parent_name\}/g, entry.parent_name);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      toast.success(`${entry.parent_name} אושר בהצלחה!`);
      onRefresh();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('שגיאה באישור המשתמש');
    } finally {
      setApprovingId(null);
    }
  };

  const handleResend = (entry: WaitlistEntry) => {
    const cleanPhone = entry.phone.replace(/[\s\-()]/g, '').replace(/^0/, '972');
    const message = messageTemplate.replace(/\{parent_name\}/g, entry.parent_name);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען רשימת המתנה...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Conversion Funnel */}
      {funnel && funnel.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              משפך המרה
            </CardTitle>
            <CardDescription>מרשימת המתנה ועד משתמש פעיל</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
              {funnel.map((stage, index) => (
                <div key={stage.stage} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[100px]">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        backgroundColor: `hsl(var(--primary) / ${0.2 + (index * 0.2)})`,
                        borderColor: `hsl(var(--primary))`,
                        borderWidth: '2px'
                      }}
                    >
                      {stage.count}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">{stage.stage}</p>
                  </div>
                  {index < funnel.length - 1 && (
                    <div className="w-8 h-0.5 bg-primary/30 mx-2" />
                  )}
                </div>
              ))}
            </div>
            {funnel.length > 1 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  שיעור המרה מ-Waitlist להרשמה:{" "}
                  <span className="font-bold text-primary">
                    {funnel[0].count > 0 
                      ? ((funnel[1].count / funnel[0].count) * 100).toFixed(1) 
                      : 0}%
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">סה"כ ממתינים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{entries.length}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Android</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-500">
              {androidCount}
              <span className="text-sm font-normal text-muted-foreground ms-2">
                ({entries.length > 0 ? ((androidCount / entries.length) * 100).toFixed(0) : 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">iPhone</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-500">
              {iphoneCount}
              <span className="text-sm font-normal text-muted-foreground ms-2">
                ({entries.length > 0 ? ((iphoneCount / entries.length) * 100).toFixed(0) : 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">ממתינים לאישור</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-500">
              {entries.filter(e => e.status === 'pending').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              רשימת המתנה
            </CardTitle>
            <CardDescription>{filteredEntries.length} תוצאות</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditingTemplate(messageTemplate); setShowTemplateEditor(true); }}
            className="gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            ערוך הודעה
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם, אימייל או טלפון..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="מכשיר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="android">Android</SelectItem>
                <SelectItem value="iphone">iPhone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Waitlist Table */}
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">שם הורה</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">גיל ילד</TableHead>
                  <TableHead className="text-right">מכשיר</TableHead>
                  <TableHead className="text-right">תאריך הרשמה</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      אין רשומות ברשימת ההמתנה
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{entry.parent_name}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.email}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.phone}</TableCell>
                      <TableCell className="text-center">{entry.child_age}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            entry.device_os.toLowerCase().includes('android')
                              ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }
                        >
                          {entry.device_os}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(entry.created_at), "dd/MM/yy", { locale: he })}
                      </TableCell>
                      <TableCell>
                        {entry.status === 'approved' ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            מאושר
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
                            ממתין
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.status !== 'approved' ? (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(entry)}
                            disabled={approvingId === entry.id}
                            className="gap-1"
                          >
                            {approvingId === entry.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            אשר
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(entry)}
                            className="gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            שלח שוב
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת הודעת WhatsApp</DialogTitle>
            <DialogDescription>
              השתמש ב-<code className="bg-muted px-1 rounded text-xs">{'{parent_name}'}</code> כדי להכניס את שם ההורה אוטומטית
            </DialogDescription>
          </DialogHeader>
          <Textarea
            dir="rtl"
            value={editingTemplate}
            onChange={(e) => setEditingTemplate(e.target.value)}
            className="min-h-[300px] font-mono text-sm leading-relaxed"
          />
          <div className="flex gap-2 justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingTemplate(DEFAULT_MESSAGE_TEMPLATE)}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              איפוס לברירת מחדל
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTemplateEditor(false)}>
                ביטול
              </Button>
              <Button onClick={() => {
                setMessageTemplate(editingTemplate);
                localStorage.setItem(STORAGE_KEY, editingTemplate);
                setShowTemplateEditor(false);
                toast.success('תבנית ההודעה נשמרה');
              }}>
                שמור
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight, User, Mail, Phone, Calendar, Baby, Smartphone, 
  UserCheck, Crown, StickyNote, History, Loader2, X, Send,
  Gift, Lock, Unlock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  children: { id: string; name: string; gender: string }[];
  devices: { device_id: string; last_seen: string | null; battery_level: number | null }[];
  device_status: 'online' | 'today' | 'offline' | 'no_device';
  last_activity: string | null;
}

interface ChildDetail {
  id: string;
  name: string;
  gender: string;
  date_of_birth: string;
  phone_number: string;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  devices: { device_id: string; last_seen: string | null; battery_level: number | null }[];
}

interface AdminNote {
  id: string;
  note_text: string;
  note_type: string;
  created_at: string;
  admin_user_id: string;
}

interface ActivityLog {
  id: string;
  action_type: string;
  action_details: any;
  created_at: string;
  admin_user_id: string;
}

interface AdminCustomerProfileProps {
  user: UserData;
  open: boolean;
  onClose: () => void;
}

const NOTE_TYPES = [
  { value: "general", label: "כללי" },
  { value: "complaint", label: "תלונה" },
  { value: "benefit", label: "הטבה" },
  { value: "lock", label: "נעילה" },
  { value: "other", label: "אחר" },
];

const ACTION_TYPE_LABELS: Record<string, string> = {
  impersonate: "צפייה כהורה",
  add_note: "הוספת הערה",
  grant_benefit: "הענקת הטבה",
  lock: "נעילת חשבון",
  unlock: "שחרור חשבון",
  edit_subscription: "עריכת מנוי",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  complaint: "bg-red-500/20 text-red-400 border-red-500/30",
  benefit: "bg-green-500/20 text-green-400 border-green-500/30",
  lock: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function AdminCustomerProfile({ user, open, onClose }: AdminCustomerProfileProps) {
  const [childrenDetails, setChildrenDetails] = useState<ChildDetail[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [grantingPremium, setGrantingPremium] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [iframeOpen, setIframeOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingTokensRef = useRef<{ access_token: string; refresh_token: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchCustomerData();
    }
  }, [open, user.id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch children with subscription info
      const { data: children } = await supabase
        .from("children")
        .select("id, name, gender, date_of_birth, phone_number, subscription_tier, subscription_expires_at")
        .eq("parent_id", user.id);

      const childIds = children?.map(c => c.id) || [];

      // Fetch devices for these children
      const { data: devices } = childIds.length > 0
        ? await supabase.from("devices").select("device_id, child_id, last_seen, battery_level").in("child_id", childIds)
        : { data: [] };

      const childrenWithDevices: ChildDetail[] = (children || []).map(child => ({
        ...child,
        devices: (devices || []).filter(d => d.child_id === child.id).map(d => ({
          device_id: d.device_id,
          last_seen: d.last_seen,
          battery_level: d.battery_level,
        })),
      }));

      setChildrenDetails(childrenWithDevices);

      // Fetch notes
      const { data: notesData } = await supabase
        .from("admin_notes")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });

      setNotes(notesData || []);

      // Fetch activity log
      const { data: logData } = await supabase
        .from("admin_activity_log")
        .select("*")
        .eq("target_parent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setActivityLog(logData || []);
    } catch (err) {
      console.error("Error fetching customer data:", err);
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async (actionType: string, details: Record<string, unknown> = {}) => {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) return;

    await supabase.from("admin_activity_log").insert([{
      admin_user_id: adminUser.id,
      target_parent_id: user.id,
      action_type: actionType,
      action_details: details as any,
    }]);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) throw new Error("Not authenticated");

      const { error } = await supabase.from("admin_notes").insert({
        parent_id: user.id,
        admin_user_id: adminUser.id,
        note_text: newNote.trim(),
        note_type: noteType,
      });

      if (error) throw error;

      await logActivity("add_note", { note_type: noteType, note_preview: newNote.trim().slice(0, 50) });
      setNewNote("");
      setNoteType("general");
      fetchCustomerData();
      toast({ title: "הערה נוספה בהצלחה" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await supabase.from("admin_notes").delete().eq("id", noteId);
      fetchCustomerData();
      toast({ title: "הערה נמחקה" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    }
  };

  const handleGrantPremium = async () => {
    if (childrenDetails.length === 0) {
      toast({ variant: "destructive", title: "אין ילדים", description: "ללקוח זה אין ילדים רשומים" });
      return;
    }
    setGrantingPremium(true);
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const childIds = childrenDetails.map(c => c.id);
      const { error } = await supabase
        .from("children")
        .update({
          subscription_tier: "premium",
          subscription_expires_at: expiresAt.toISOString(),
        })
        .in("id", childIds);

      if (error) throw error;

      await logActivity("grant_benefit", {
        type: "premium_month",
        children_count: childIds.length,
        expires_at: expiresAt.toISOString(),
      });

      fetchCustomerData();
      toast({ title: "הטבה הוענקה", description: `חודש Premium הוענק ל-${childIds.length} ילדים` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setGrantingPremium(false);
    }
  };

  // Impersonation logic
  const sendTokensToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const tokens = pendingTokensRef.current;
    if (!iframe?.contentWindow || !tokens) return;
    iframe.contentWindow.postMessage(
      { type: "impersonate-tokens", ...tokens },
      window.location.origin
    );
    pendingTokensRef.current = null;
  }, []);

  const handleIframeLoad = useCallback(() => {
    sendTokensToIframe();
  }, [sendTokensToIframe]);

  const handleImpersonate = async () => {
    setImpersonatingId(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { userId: user.id },
      });
      if (error || !data?.access_token) {
        throw new Error(data?.error || error?.message || "Failed to impersonate");
      }

      await logActivity("impersonate");

      pendingTokensRef.current = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
      setIframeOpen(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה בהתחזות", description: err.message });
    } finally {
      setImpersonatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">🟢 אונליין</Badge>;
      case 'today':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">🟡 פעיל היום</Badge>;
      case 'offline':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔴 לא פעיל</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">⚪ ללא מכשיר</Badge>;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0" dir="rtl">
          <SheetHeader className="p-6 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {user.full_name}
              </SheetTitle>
              {getStatusBadge(user.device_status)}
            </div>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">פרטי לקוח</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{user.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span dir="ltr">{user.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>נרשם {format(new Date(user.created_at), "dd/MM/yyyy", { locale: he })}</span>
                  </div>
                  {user.last_activity && (
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <span>פעילות אחרונה: {formatDistanceToNow(new Date(user.last_activity), { addSuffix: true, locale: he })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Children & Subscriptions */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Baby className="w-4 h-4" />
                    ילדים ומנויים
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {childrenDetails.length === 0 ? (
                    <p className="text-muted-foreground text-sm">אין ילדים רשומים</p>
                  ) : (
                    <div className="space-y-3">
                      {childrenDetails.map(child => (
                        <div key={child.id} className="rounded-lg border border-border/50 p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{child.name}</span>
                            <Badge variant={child.subscription_tier === 'premium' ? 'default' : 'outline'} className={child.subscription_tier === 'premium' ? 'bg-primary/20 text-primary border-primary/30' : ''}>
                              {child.subscription_tier === 'premium' ? '👑 Premium' : 'Free'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-3">
                            <span>{child.gender === 'male' ? 'זכר' : 'נקבה'}</span>
                            <span>נולד: {format(new Date(child.date_of_birth), "dd/MM/yyyy")}</span>
                            {child.subscription_expires_at && (
                              <span>תפוגה: {format(new Date(child.subscription_expires_at), "dd/MM/yyyy")}</span>
                            )}
                          </div>
                          {child.devices.length > 0 && (
                            <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                              {child.devices.map(d => (
                                <Badge key={d.device_id} variant="outline" className="text-xs font-mono">
                                  {d.device_id.slice(0, 8)}...
                                  {d.battery_level != null && ` 🔋${d.battery_level}%`}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">פעולות מהירות</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={impersonatingId === user.id}
                    onClick={handleImpersonate}
                  >
                    {impersonatingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    צפה כהורה
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={grantingPremium || childrenDetails.length === 0}
                    onClick={handleGrantPremium}
                  >
                    {grantingPremium ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    הענק חודש Premium
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2 opacity-50 cursor-not-allowed" disabled>
                    <Lock className="w-4 h-4" />
                    נעל חשבון (בקרוב)
                  </Button>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <StickyNote className="w-4 h-4" />
                    הערות ({notes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add note form */}
                  <div className="space-y-2 rounded-lg border border-border/50 p-3">
                    <Textarea
                      placeholder="כתוב הערה חדשה..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[60px] resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <Select value={noteType} onValueChange={setNoteType}>
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOTE_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="gap-1 h-8"
                        disabled={!newNote.trim() || submittingNote}
                        onClick={handleAddNote}
                      >
                        {submittingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        שמור
                      </Button>
                    </div>
                  </div>

                  {/* Notes list */}
                  {notes.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-2">אין הערות</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {notes.map(note => (
                        <div key={note.id} className="rounded-lg border border-border/50 p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={`text-xs ${NOTE_TYPE_COLORS[note.note_type] || ''}`}>
                              {NOTE_TYPES.find(t => t.value === note.note_type)?.label || note.note_type}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: he })}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap">{note.note_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Log */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4" />
                    לוג פעולות ({activityLog.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLog.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-2">אין פעולות מתועדות</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {activityLog.map(log => (
                        <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {ACTION_TYPE_LABELS[log.action_type] || log.action_type}
                            </Badge>
                            {log.action_details && Object.keys(log.action_details).length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {log.action_type === 'grant_benefit' && (log.action_details as any).type === 'premium_month'
                                  ? `חודש Premium ל-${(log.action_details as any).children_count} ילדים`
                                  : log.action_type === 'add_note'
                                    ? (log.action_details as any).note_preview
                                    : null}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: he })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Impersonation iframe dialog */}
      <Dialog open={iframeOpen} onOpenChange={(v) => !v && setIframeOpen(false)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">מצב התחזות — {user.full_name}</DialogTitle>
          <div
            dir="rtl"
            className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>מצב התחזות — צופה כ: {user.full_name}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-black/30 bg-black/10 hover:bg-black/20 text-black"
              onClick={() => setIframeOpen(false)}
            >
              <X className="w-3 h-3 me-1" />
              סגור
            </Button>
          </div>
          <iframe
            ref={iframeRef}
            src="/impersonate-session"
            className="w-full flex-1 border-0"
            style={{ height: "calc(90vh - 40px)" }}
            onLoad={handleIframeLoad}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

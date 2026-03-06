import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight, User, Mail, Phone, Calendar, Baby, Smartphone,
  UserCheck, Crown, StickyNote, History, Loader2, X, Send,
  Gift, Lock, Unlock, MessageSquare, Pencil, Save, Trash2, Users, RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { adminSupabase } from "@/integrations/supabase/admin-client";
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

interface HeartbeatData {
  device: { manufacturer?: string; model?: string; sdkInt?: number; appVersionName?: string; appVersionCode?: number };
  permissions: {
    accessibilityEnabled?: boolean;
    notificationListenerEnabled?: boolean;
    usageStatsGranted?: boolean;
    locationPermissionGranted?: boolean;
    locationServicesEnabled?: boolean;
    batteryOptimizationIgnored?: boolean;
  };
  reported_at: string;
}

interface ChildDetail {
  id: string;
  name: string;
  gender: string;
  date_of_birth: string;
  phone_number: string;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  devices: { device_id: string; last_seen: string | null; battery_level: number | null; device_model: string | null; device_manufacturer: string | null; appUsage7d: number; realAlerts7d: number; heartbeat: HeartbeatData | null; warmupStartedAt: string | null }[];
  permissionAlerts: { parent_message: string | null; created_at: string }[];
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
  onUserDeleted?: () => void;
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
  edit_parent: "עריכת פרטי הורה",
  edit_child: "עריכת פרטי ילד",
  delete_user: "מחיקת משתמש",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  complaint: "bg-red-500/20 text-red-400 border-red-500/30",
  benefit: "bg-green-500/20 text-green-400 border-green-500/30",
  lock: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function AdminCustomerProfile({ user, open, onClose, onUserDeleted }: AdminCustomerProfileProps) {
  const [childrenDetails, setChildrenDetails] = useState<ChildDetail[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [grantingPremium, setGrantingPremium] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [iframeOpen, setIframeOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingTokensRef = useRef<{ access_token: string; refresh_token: string } | null>(null);

  // Edit parent state
  const [editingParent, setEditingParent] = useState(false);
  const [editParentName, setEditParentName] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [savingParent, setSavingParent] = useState(false);

  // Edit child state
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildName, setEditChildName] = useState("");
  const [editChildPhone, setEditChildPhone] = useState("");
  const [editChildGender, setEditChildGender] = useState("");
  const [editChildDob, setEditChildDob] = useState("");
  const [savingChild, setSavingChild] = useState(false);

  // Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Group state
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string; color: string }[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);

  // Heartbeat request state
  const [requestingHeartbeat, setRequestingHeartbeat] = useState<Record<string, boolean>>({});
  const [awaitingHeartbeat, setAwaitingHeartbeat] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchCustomerData();
    }
  }, [open, user.id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch parent's is_locked status and group_id
      const { data: parentData } = await adminSupabase
        .from("parents")
        .select("is_locked, group_id" as any)
        .eq("id", user.id)
        .maybeSingle();
      setIsLocked((parentData as any)?.is_locked ?? false);
      setGroupId((parentData as any)?.group_id ?? null);

      // Fetch groups list
      const { data: groupsData } = await (adminSupabase.from("customer_groups") as any).select("id, name, color").order("created_at");
      setGroups((groupsData || []) as any[]);

      // Fetch children with subscription info
      const { data: children } = await adminSupabase
        .from("children")
        .select("id, name, gender, date_of_birth, phone_number, subscription_tier, subscription_expires_at")
        .eq("parent_id", user.id);

      const childIds = children?.map(c => c.id) || [];

      const { data: devices } = childIds.length > 0
        ? await adminSupabase.from("devices").select("device_id, child_id, last_seen, battery_level, device_model, device_manufacturer" as any).in("child_id", childIds)
        : { data: [] };

      // Fetch permission alerts for children
      const { data: permAlerts } = childIds.length > 0
        ? await adminSupabase.from("alerts").select("child_id, parent_message, created_at").eq("category", "PERMISSION_MISSING").is("acknowledged_at", null).in("child_id", childIds)
        : { data: [] };

      // Smart permission detection: fetch app_usage and real alerts counts per device (last 7 days)
      const deviceIds = (devices || []).map((d: any) => d.device_id);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]; // date only for usage_date

      const { data: appUsageCounts } = deviceIds.length > 0
        ? await adminSupabase.from("app_usage").select("device_id").in("device_id", deviceIds).gte("usage_date", sevenDaysAgoStr)
        : { data: [] };

      const { data: realAlertsCounts } = deviceIds.length > 0
        ? await adminSupabase.from("alerts").select("device_id").in("device_id", deviceIds).gte("created_at", sevenDaysAgo.toISOString()).neq("category", "PERMISSION_MISSING")
        : { data: [] };

      // Fetch latest heartbeat per device
      const heartbeatByDevice: Record<string, HeartbeatData> = {};
      if (deviceIds.length > 0) {
        for (const did of deviceIds) {
          const { data: hbRows } = await adminSupabase
            .from("device_heartbeats_raw")
            .select("device, permissions, reported_at")
            .eq("device_id", did)
            .order("reported_at", { ascending: false })
            .limit(1);
          if (hbRows && hbRows.length > 0) {
            heartbeatByDevice[did] = {
              device: hbRows[0].device as any,
              permissions: hbRows[0].permissions as any,
              reported_at: hbRows[0].reported_at,
            };
          }
        }
      }

      // Count per device
      const appUsageByDevice: Record<string, number> = {};
      (appUsageCounts || []).forEach((r: any) => { appUsageByDevice[r.device_id] = (appUsageByDevice[r.device_id] || 0) + 1; });
      const realAlertsByDevice: Record<string, number> = {};
      (realAlertsCounts || []).forEach((r: any) => { realAlertsByDevice[r.device_id] = (realAlertsByDevice[r.device_id] || 0) + 1; });

      const childrenWithDevices: ChildDetail[] = (children || []).map(child => ({
        ...child,
        devices: (devices || [])
          .filter((d: any) => d.child_id === child.id)
          .sort((a: any, b: any) => {
            const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
            const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 1)
          .map((d: any) => ({
            device_id: d.device_id,
            last_seen: d.last_seen,
            battery_level: d.battery_level,
            device_model: d.device_model || null,
            device_manufacturer: d.device_manufacturer || null,
            appUsage7d: appUsageByDevice[d.device_id] || 0,
            realAlerts7d: realAlertsByDevice[d.device_id] || 0,
            heartbeat: heartbeatByDevice[d.device_id] || null,
          })),
        permissionAlerts: (permAlerts || []).filter((a: any) => a.child_id === child.id).map((a: any) => ({
          parent_message: a.parent_message,
          created_at: a.created_at,
        })),
      }));

      setChildrenDetails(childrenWithDevices);

      const { data: notesData } = await adminSupabase
        .from("admin_notes")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });
      setNotes(notesData || []);

      const { data: logData } = await adminSupabase
        .from("admin_activity_log")
        .select("*")
        .eq("target_parent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setActivityLog(logData || []);

      // Fetch admin names for activity log
      if (logData && logData.length > 0) {
        const uniqueAdminIds = [...new Set(logData.map((l: any) => l.admin_user_id))];
        const { data: admins } = await adminSupabase
          .from("parents")
          .select("id, full_name")
          .in("id", uniqueAdminIds);
        if (admins) {
          const map: Record<string, string> = {};
          admins.forEach((a: any) => { map[a.id] = a.full_name; });
          setAdminNames(map);
        }
      }
    } catch (err) {
      console.error("Error fetching customer data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupChange = async (newGroupId: string) => {
    setSavingGroup(true);
    try {
      const val = newGroupId === "none" ? null : newGroupId;
      const { error } = await (adminSupabase.from("parents") as any)
        .update({ group_id: val })
        .eq("id", user.id);
      if (error) throw error;
      setGroupId(val);
      const groupName = groups.find(g => g.id === val)?.name || "ללא";
      await logActivity("change_group", { group_id: val, group_name: groupName });
      toast({ title: `קבוצה עודכנה: ${groupName}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setSavingGroup(false);
    }
  };

  // === REQUEST HEARTBEAT ===
  const handleRequestHeartbeat = async (deviceId: string) => {
    setRequestingHeartbeat(prev => ({ ...prev, [deviceId]: true }));
    try {
      // 1. Fetch baseline ID FIRST (before sending command) — clock-independent polling
      const { data: lastHb } = await adminSupabase
        .from("device_heartbeats_raw")
        .select("id")
        .eq("device_id", deviceId)
        .order("id", { ascending: false })
        .limit(1);
      const lastHbId = lastHb?.[0]?.id ?? 0;

      // 2. THEN send the command
      const { error } = await adminSupabase.from("device_commands").insert({
        device_id: deviceId,
        command_type: "REPORT_HEARTBEAT",
        status: "PENDING",
      } as any);
      if (error) throw error;

      // Switch to "awaiting" state
      setRequestingHeartbeat(prev => ({ ...prev, [deviceId]: false }));
      setAwaitingHeartbeat(prev => ({ ...prev, [deviceId]: true }));

      let pollCount = 0;
      const maxPolls = 10; // 10 * 3s = 30s

      const interval = setInterval(async () => {
        pollCount++;
        try {
          const { data } = await adminSupabase
            .from("device_heartbeats_raw")
            .select("device, permissions, reported_at")
            .eq("device_id", deviceId)
            .gt("id", lastHbId)
            .order("id", { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            clearInterval(interval);
            const newHb = data[0] as any;

            // Update childrenDetails state with new heartbeat
            setChildrenDetails(prev => prev.map(child => ({
              ...child,
              devices: child.devices.map(d =>
                d.device_id === deviceId
                  ? { ...d, heartbeat: { device: newHb.device, permissions: newHb.permissions, reported_at: newHb.reported_at } }
                  : d
              )
            })));

            setAwaitingHeartbeat(prev => ({ ...prev, [deviceId]: false }));
            toast({ title: "✓ התקבל דיווח הרשאות", description: "נתוני ההרשאות עודכנו בהצלחה" });
          }
        } catch {
          // ignore polling errors
        }

        if (pollCount >= maxPolls) {
          clearInterval(interval);
          setAwaitingHeartbeat(prev => ({ ...prev, [deviceId]: false }));
          toast({ variant: "destructive", title: "המכשיר לא הגיב", description: "ייתכן שהמכשיר אינו מחובר לאינטרנט" });
        }
      }, 3000);
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
      setRequestingHeartbeat(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const logActivity = async (actionType: string, details: Record<string, any> = {}) => {
    const { data: { user: adminUser } } = await adminSupabase.auth.getUser();
    if (!adminUser) return;
    await adminSupabase.from("admin_activity_log").insert([{
      admin_user_id: adminUser.id,
      target_parent_id: user.id,
      action_type: actionType,
      action_details: details as any,
    }]);
  };

  // === PARENT EDIT ===
  const startEditParent = () => {
    setEditParentName(user.full_name);
    setEditParentPhone(user.phone || "");
    setEditingParent(true);
  };

  const saveParent = async () => {
    setSavingParent(true);
    try {
      const { error } = await adminSupabase
        .from("parents")
        .update({ full_name: editParentName.trim(), phone: editParentPhone.trim() || null })
        .eq("id", user.id);
      if (error) throw error;

      await logActivity("edit_parent", { full_name: editParentName.trim(), phone: editParentPhone.trim() });
      // Update local user object for display
      user.full_name = editParentName.trim();
      user.phone = editParentPhone.trim() || null;
      setEditingParent(false);
      toast({ title: "פרטי הלקוח עודכנו" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setSavingParent(false);
    }
  };

  // === CHILD EDIT ===
  const startEditChild = (child: ChildDetail) => {
    setEditingChildId(child.id);
    setEditChildName(child.name);
    setEditChildPhone(child.phone_number || "");
    setEditChildGender(child.gender);
    setEditChildDob(child.date_of_birth);
  };

  const saveChild = async () => {
    if (!editingChildId) return;
    setSavingChild(true);
    try {
      const { error } = await adminSupabase
        .from("children")
        .update({
          name: editChildName.trim(),
          phone_number: editChildPhone.trim(),
          gender: editChildGender,
          date_of_birth: editChildDob,
        })
        .eq("id", editingChildId);
      if (error) throw error;

      await logActivity("edit_child", { child_id: editingChildId, name: editChildName.trim() });
      setEditingChildId(null);
      fetchCustomerData();
      toast({ title: "פרטי הילד עודכנו" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setSavingChild(false);
    }
  };

  // === LOCK/UNLOCK ===
  const toggleLock = async () => {
    setLockLoading(true);
    const newLocked = !isLocked;
    try {
      const { error } = await adminSupabase
        .from("parents")
        .update({ is_locked: newLocked } as any)
        .eq("id", user.id);
      if (error) throw error;

      await logActivity(newLocked ? "lock" : "unlock");
      setIsLocked(newLocked);
      toast({ title: newLocked ? "החשבון ננעל" : "החשבון שוחרר" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setLockLoading(false);
    }
  };

  // === DELETE USER ===
  const handleDeleteUser = async () => {
    setDeleting(true);
    try {
      const { data, error } = await adminSupabase.functions.invoke("admin-delete-user", {
        body: { userId: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "המשתמש נמחק בהצלחה" });
      setDeleteDialogOpen(false);
      if (onUserDeleted) {
        onUserDeleted();
      } else {
        onClose();
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה במחיקה", description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  // === WHATSAPP ===
  const getWhatsAppPhone = (): string | null => {
    if (user.phone) return user.phone;
    // Fallback to first child's phone
    const childPhone = childrenDetails.find(c => c.phone_number)?.phone_number;
    return childPhone || null;
  };

  const openWhatsApp = () => {
    const phone = getWhatsAppPhone();
    if (!phone) return;
    const cleaned = phone.replace(/[^0-9+]/g, "");
    const intl = cleaned.startsWith("0") ? "972" + cleaned.slice(1) : cleaned.replace("+", "");
    const msg = encodeURIComponent(`שלום ${user.full_name}, פונים אליך מ-KippyAI 🙏`);
    window.open(`https://wa.me/${intl}?text=${msg}`, "_blank");
  };

  // === NOTES ===
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const { data: { user: adminUser } } = await adminSupabase.auth.getUser();
      if (!adminUser) throw new Error("Not authenticated");
      const { error } = await adminSupabase.from("admin_notes").insert({
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
      await adminSupabase.from("admin_notes").delete().eq("id", noteId);
      fetchCustomerData();
      toast({ title: "הערה נמחקה" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    }
  };

  // === PREMIUM ===
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
      const { error } = await adminSupabase
        .from("children")
        .update({ subscription_tier: "premium", subscription_expires_at: expiresAt.toISOString() })
        .in("id", childIds);
      if (error) throw error;
      await logActivity("grant_benefit", { type: "premium_month", children_count: childIds.length, expires_at: expiresAt.toISOString() });
      fetchCustomerData();
      toast({ title: "הטבה הוענקה", description: `חודש Premium הוענק ל-${childIds.length} ילדים` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה", description: err.message });
    } finally {
      setGrantingPremium(false);
    }
  };

  // === IMPERSONATION ===
  const sendTokensToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const tokens = pendingTokensRef.current;
    if (!iframe?.contentWindow || !tokens) return;
    iframe.contentWindow.postMessage({ type: "impersonate-tokens", ...tokens }, window.location.origin);
    pendingTokensRef.current = null;
  }, []);

  const handleIframeLoad = useCallback(() => { sendTokensToIframe(); }, [sendTokensToIframe]);

  const handleImpersonate = async () => {
    setImpersonatingId(user.id);
    try {
      // Verify admin session is still valid
      const { data: { session } } = await adminSupabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'הסשן פג', description: 'יש להתחבר מחדש לדף הניהול' });
        window.location.href = '/admin-login';
        return;
      }
      const { data, error } = await adminSupabase.functions.invoke("impersonate-user", { body: { userId: user.id } });
      if (error || !data?.access_token) throw new Error(data?.error || error?.message || "Failed to impersonate");
      await logActivity("impersonate");
      pendingTokensRef.current = { access_token: data.access_token, refresh_token: data.refresh_token };
      setIframeOpen(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה בהתחזות", description: err.message });
    } finally {
      setImpersonatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">🟢 אונליין</Badge>;
      case 'today': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">🟡 פעיל היום</Badge>;
      case 'offline': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔴 לא פעיל</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground">⚪ ללא מכשיר</Badge>;
    }
  };

  const whatsAppPhone = getWhatsAppPhone();

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0" dir="rtl">
          <SheetHeader className="p-6 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {user.full_name}
                {isLocked && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">🔒 נעול</Badge>}
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">פרטי לקוח</CardTitle>
                    {!editingParent ? (
                      <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={startEditParent}>
                        <Pencil className="w-3 h-3" /> ערוך
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingParent(false)}>
                          <X className="w-3 h-3" />
                        </Button>
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={saveParent} disabled={savingParent}>
                          {savingParent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          שמור
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {editingParent ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">שם מלא</label>
                        <Input value={editParentName} onChange={e => setEditParentName(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">טלפון</label>
                        <Input value={editParentPhone} onChange={e => setEditParentPhone(e.target.value)} dir="ltr" className="h-8 text-sm" placeholder="050-1234567" />
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>{user.email || "—"}</span>
                        <span className="text-xs">(לא ניתן לעריכה)</span>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                  {/* Group assignment */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/30 mt-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">קבוצה:</span>
                    <Select
                      value={groupId || "none"}
                      onValueChange={handleGroupChange}
                      disabled={savingGroup}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא קבוצה</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                              {g.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingGroup && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
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
                        <div key={child.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                          {editingChildId === child.id ? (
                            // Edit mode
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">עריכת פרטי ילד</span>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingChildId(null)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" className="h-6 text-xs gap-1" onClick={saveChild} disabled={savingChild}>
                                    {savingChild ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    שמור
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-muted-foreground">שם</label>
                                  <Input value={editChildName} onChange={e => setEditChildName(e.target.value)} className="h-7 text-xs" />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">מספר טלפון</label>
                                  <Input value={editChildPhone} onChange={e => setEditChildPhone(e.target.value)} dir="ltr" className="h-7 text-xs" placeholder="050-..." />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">מגדר</label>
                                  <Select value={editChildGender} onValueChange={setEditChildGender}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">זכר</SelectItem>
                                      <SelectItem value="female">נקבה</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">תאריך לידה</label>
                                  <Input type="date" value={editChildDob} onChange={e => setEditChildDob(e.target.value)} dir="ltr" className="h-7 text-xs" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{child.name}</span>
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => startEditChild(child)}>
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </div>
                                <Badge variant={child.subscription_tier === 'premium' ? 'default' : 'outline'} className={child.subscription_tier === 'premium' ? 'bg-primary/20 text-primary border-primary/30' : ''}>
                                  {child.subscription_tier === 'premium' ? '👑 Premium' : 'Free'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                                <span>{child.gender === 'male' ? 'זכר' : 'נקבה'}</span>
                                <span>נולד: {format(new Date(child.date_of_birth), "dd/MM/yyyy")}</span>
                                <span dir="ltr">📱 {child.phone_number || "—"}</span>
                                {child.subscription_expires_at && (
                                  <span>תפוגה: {format(new Date(child.subscription_expires_at), "dd/MM/yyyy")}</span>
                                )}
                              </div>
                              {child.devices.length > 0 && (
                                <div className="space-y-2 mt-1">
                                  {child.devices.map(d => {
                                    const hb = d.heartbeat;
                                    // Prefer heartbeat data for model display
                                    const modelDisplay = hb?.device?.manufacturer || hb?.device?.model
                                      ? `${hb.device.manufacturer || ''} ${hb.device.model || ''}`.trim()
                                      : d.device_manufacturer || d.device_model
                                        ? `${d.device_manufacturer || ''} ${d.device_model || ''}`.trim()
                                        : null;
                                    return (
                                      <div key={d.device_id} className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                          <Smartphone className="w-3 h-3" />
                                          <span className="font-medium">{modelDisplay || "📱 דגם לא דווח"}</span>
                                          {hb?.device?.appVersionName && (
                                            <Badge variant="outline" className="text-xs h-5 px-1.5">
                                              v{hb.device.appVersionName}
                                            </Badge>
                                          )}
                                          {d.battery_level != null && (
                                            <Badge variant="outline" className="text-xs h-5 px-1.5">
                                              🔋 {d.battery_level}%
                                            </Badge>
                                          )}
                                          {d.last_seen && (
                                            <span className="text-muted-foreground/70">
                                              נראה {formatDistanceToNow(new Date(d.last_seen), { addSuffix: true, locale: he })}
                                            </span>
                                          )}
                                        </div>
                                        {/* Permission badges from heartbeat */}
                                        {hb ? (
                                          <div className="flex flex-wrap gap-1">
                                            {([
                                              ['accessibilityEnabled', 'Accessibility'],
                                              ['notificationListenerEnabled', 'Notifications'],
                                              ['usageStatsGranted', 'Usage Stats'],
                                              ['locationPermissionGranted', 'Location'],
                                              ['batteryOptimizationIgnored', 'Battery Opt'],
                                            ] as const).map(([key, label]) => {
                                              const val = (hb.permissions as any)?.[key];
                                              if (val === undefined) return null;
                                              return (
                                                <Badge
                                                  key={key}
                                                  className={`text-[10px] h-4 px-1.5 ${val ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
                                                >
                                                  {val ? '✓' : '✗'} {label}
                                                </Badge>
                                              );
                                            })}
                                            <span className="text-[10px] text-muted-foreground/50">
                                              ({formatDistanceToNow(new Date(hb.reported_at), { addSuffix: true, locale: he })})
                                            </span>
                                          </div>
                                        ) : (
                                          // Fallback: heuristic-based detection
                                          d.appUsage7d > 0 && d.realAlerts7d === 0 ? (
                                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] h-4 px-1.5" title="יש שימוש באפליקציות אבל אין התראות ב-7 ימים אחרונים">
                                              ⚠️ חשד להרשאות חסרות (אין heartbeat)
                                            </Badge>
                                          ) : null
                                        )}
                                        {/* Request Heartbeat button */}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 text-[10px] gap-1 px-1.5 text-muted-foreground hover:text-primary"
                                          disabled={!!requestingHeartbeat[d.device_id] || !!awaitingHeartbeat[d.device_id]}
                                          onClick={() => handleRequestHeartbeat(d.device_id)}
                                        >
                                          {requestingHeartbeat[d.device_id] || awaitingHeartbeat[d.device_id] ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <RefreshCw className="w-3 h-3" />
                                          )}
                                          {awaitingHeartbeat[d.device_id] ? "ממתין לתשובה..." : "בדוק הרשאות"}
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Legacy permission alerts from DB */}
                              {child.permissionAlerts.length > 0 && !child.devices.some(d => d.heartbeat) && (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs mt-1">
                                  ⚠️ הרשאות חסרות
                                </Badge>
                              )}
                            </>
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
                  <Button size="sm" variant="outline" className="gap-2" disabled={impersonatingId === user.id} onClick={handleImpersonate}>
                    {impersonatingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    צפה כהורה
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-green-500 border-green-500/30 hover:bg-green-500/10"
                    disabled={!whatsAppPhone}
                    onClick={openWhatsApp}
                    title={whatsAppPhone ? "שלח הודעת WhatsApp" : "אין מספר טלפון (לא להורה ולא לילד)"}
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
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
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-2 ${isLocked ? 'text-green-500 border-green-500/30 hover:bg-green-500/10' : 'text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10'}`}
                    disabled={lockLoading}
                    onClick={toggleLock}
                  >
                    {lockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {isLocked ? "שחרר חשבון" : "נעל חשבון"}
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
                  <div className="space-y-2 rounded-lg border border-border/50 p-3">
                    <Textarea placeholder="כתוב הערה חדשה..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] resize-none" />
                    <div className="flex items-center gap-2">
                      <Select value={noteType} onValueChange={setNoteType}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NOTE_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="gap-1 h-8" disabled={!newNote.trim() || submittingNote} onClick={handleAddNote}>
                        {submittingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        שמור
                      </Button>
                    </div>
                  </div>
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
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteNote(note.id)}>
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
                            {adminNames[log.admin_user_id] || "אדמין"} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: he })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-red-400">אזור מסוכן</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    מחק משתמש לצמיתות
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    פעולה זו תמחק את המשתמש, הילדים, המכשירים, ההתראות וכל המידע הקשור. לא ניתן לשחזר.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת משתמש לצמיתות</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את <strong>{user.full_name}</strong> ואת כל המידע הקשור אליו (ילדים, מכשירים, התראות).
              <br />לאישור, הקלד את שם המשתמש: <strong>{user.full_name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmName}
            onChange={e => setDeleteConfirmName(e.target.value)}
            placeholder={user.full_name}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmName(""); }}>ביטול</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== user.full_name || deleting}
              onClick={handleDeleteUser}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Trash2 className="w-4 h-4 me-2" />}
              מחק לצמיתות
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Impersonation iframe dialog */}
      <Dialog open={iframeOpen} onOpenChange={(v) => !v && setIframeOpen(false)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">מצב התחזות — {user.full_name}</DialogTitle>
          <div dir="rtl" className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>מצב התחזות — צופה כ: {user.full_name}</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 border-black/30 bg-black/10 hover:bg-black/20 text-black" onClick={() => setIframeOpen(false)}>
              <X className="w-3 h-3 me-1" /> סגור
            </Button>
          </div>
          <iframe ref={iframeRef} src="/impersonate-session" className="w-full flex-1 border-0" style={{ height: "calc(90vh - 40px)" }} onLoad={handleIframeLoad} />
        </DialogContent>
      </Dialog>
    </>
  );
}

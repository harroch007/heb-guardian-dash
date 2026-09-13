import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  cancelGuardianInvite,
  createGuardianInvite,
  listGuardianInvites,
  regenerateGuardianInviteCode,
  type V2GuardianInvite,
} from "@/lib/v2/guardianInvites";

const statusLabel: Record<V2GuardianInvite["status"], string> = {
  pending: "ממתין להצטרפות",
  accepted: "הצטרף",
  cancelled: "בוטל",
  expired: "פג תוקף",
};

export function FamilyGuardiansSection() {
  const { familyId } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<V2GuardianInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!familyId) {
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setInvites(await listGuardianInvites(familyId));
    } catch (error) {
      console.error("[guardian-invites] load failed", error);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast({
        title: "חסרים פרטים",
        description: "יש למלא שם וכתובת אימייל תקינה",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const invite = await createGuardianInvite({ name, email });
      setCodes((prev) => ({ ...prev, [invite.inviteId]: invite.code }));
      setName("");
      setEmail("");
      setShowForm(false);
      await load();
      toast({
        title: "ההזמנה נוצרה",
        description: `הקוד להצטרפות: ${invite.code}`,
      });
    } catch (error) {
      const message = (error as { message?: string })?.message ?? "";
      toast({
        title: "לא הצלחנו ליצור הזמנה",
        description: message.includes("already_member")
          ? "ההורה הזה כבר משויך למשפחה"
          : message.includes("guardian_not_authorized")
            ? "רק ההורה הראשי יכול להזמין הורה נוסף"
            : "אפשר לנסות שוב בעוד רגע",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async (inviteId: string) => {
    try {
      const result = await regenerateGuardianInviteCode(inviteId);
      setCodes((prev) => ({ ...prev, [inviteId]: result.code }));
      await load();
      toast({ title: "קוד חדש נוצר", description: result.code });
    } catch {
      toast({ title: "לא הצלחנו ליצור קוד חדש", variant: "destructive" });
    }
  };

  const handleCancel = async (inviteId: string) => {
    try {
      await cancelGuardianInvite(inviteId);
      await load();
      toast({ title: "ההזמנה בוטלה" });
    } catch {
      toast({ title: "לא הצלחנו לבטל את ההזמנה", variant: "destructive" });
    }
  };

  const copyInvite = async (invite: V2GuardianInvite) => {
    const code = codes[invite.id];
    const link = `${window.location.origin}/join-family`;
    const text = code
      ? `הוזמנת לנהל איתי את Kippy.\nכניסה: ${link}\nאימייל: ${invite.invited_email}\nקוד: ${code}`
      : `הוזמנת לנהל איתי את Kippy.\nכניסה: ${link}\nאימייל: ${invite.invited_email}`;
    await navigator.clipboard.writeText(text);
    toast({
      title: "ההודעה הועתקה",
      description: code ? undefined : "הקוד מוצג רק בעת יצירתו — אפשר להנפיק קוד חדש",
    });
  };

  return (
    <Card dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">הורים במשפחה</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setShowForm((prev) => !prev)}
        >
          <UserPlus className="ml-1 h-4 w-4" />
          הזמנת הורה
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">שם ההורה</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: מיכל"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">אימייל</Label>
              <Input
                id="invite-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <Button
              type="button"
              className="h-11 w-full"
              disabled={saving}
              onClick={() => void handleCreate()}
            >
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              יצירת קוד הזמנה
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : invites.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            אין כרגע הורים מוזמנים. אפשר להזמין הורה נוסף לניהול המשפחה.
          </p>
        ) : (
          <ul className="space-y-3">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {invite.invited_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {invite.invited_email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {statusLabel[invite.status]}
                    </p>
                  </div>
                  {codes[invite.id] && (
                    <span
                      className="rounded-md bg-muted px-2 py-1 font-mono text-lg tracking-widest text-foreground"
                      dir="ltr"
                    >
                      {codes[invite.id]}
                    </span>
                  )}
                </div>

                {invite.status === "pending" || invite.status === "expired" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => void handleRegenerate(invite.id)}
                    >
                      <RefreshCw className="ml-1 h-4 w-4" />
                      קוד חדש
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => void copyInvite(invite)}
                    >
                      <Copy className="ml-1 h-4 w-4" />
                      העתקת הודעה
                    </Button>
                    {invite.status === "pending" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 text-destructive"
                        onClick={() => void handleCancel(invite.id)}
                      >
                        <X className="ml-1 h-4 w-4" />
                        ביטול
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const JoinFamily = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setSignedInEmail(session.user.email);
        setEmail(session.user.email);
      }
      setChecking(false);
    });
  }, []);

  const claim = async (claimEmail: string, claimCode: string) => {
    const { error } = await supabase.rpc("claim_family_invite_by_code", {
      p_email: claimEmail,
      p_code: claimCode,
    });
    if (error) throw error;
  };

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!cleanEmail || cleanCode.length !== 6) {
      toast({ title: "שגיאה", description: "מלא אימייל וקוד בן 6 ספרות", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // If not signed in, sign in or sign up
      if (!signedInEmail) {
        if (!password) {
          toast({ title: "סיסמה נדרשת", description: "הזן סיסמה כדי להתחבר/להירשם", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInErr) {
          // Try sign up
          const { error: signUpErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { emailRedirectTo: `${window.location.origin}/join-family` },
          });
          if (signUpErr) {
            toast({ title: "שגיאה בהתחברות", description: signUpErr.message, variant: "destructive" });
            setSubmitting(false);
            return;
          }
        }
      }

      await claim(cleanEmail, cleanCode);
      toast({ title: "הצטרפת למשפחה!", description: "ברוך הבא ל-KippyAI" });
      navigate("/home-v2", { replace: true });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err?.message || "לא ניתן להצטרף",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="homev2-light min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="homev2-light min-h-screen flex items-center justify-center px-4 py-8" dir="rtl">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">הצטרפות למשפחה</h1>
          <p className="text-sm text-muted-foreground">
            הזן את הקוד שקיבלת מההורה הראשי כדי להצטרף כהורה שותף
          </p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">אימייל</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
                dir="ltr"
                disabled={!!signedInEmail || submitting}
              />
            </div>

            {!signedInEmail && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">סיסמה</label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  dir="ltr"
                  disabled={submitting}
                />
                <p className="text-[11px] text-muted-foreground">
                  אם זו הפעם הראשונה — נירשם עבורך אוטומטית
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">קוד הצטרפות (6 ספרות)</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                dir="ltr"
                className="text-center text-2xl tracking-[0.4em] font-bold h-14"
                disabled={submitting}
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={submitting || !email || code.length !== 6 || (!signedInEmail && !password)}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              הצטרף למשפחה
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          אין לך קוד? פנה להורה הראשי כדי לקבל קוד הצטרפות חדש.
        </p>
      </div>
    </div>
  );
};

export default JoinFamily;

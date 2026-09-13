import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { claimGuardianInvite } from "@/lib/v2/guardianInvites";

const errorMessages: Record<string, string> = {
  INVALID_EMAIL: "כתובת אימייל לא תקינה.",
  INVALID_CODE_FORMAT: "הקוד צריך להיות 6 ספרות.",
  INVALID_CODE_OR_EMAIL: "האימייל או הקוד שגויים.",
  INVITE_MISSING_NAME: "ההזמנה חסרה שם. בקשו מההורה הראשי להנפיק הזמנה חדשה.",
};

const JoinFamily = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
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

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || !/^\d{6}$/.test(cleanCode)) {
      toast({
        title: "חסרים פרטים",
        description: "יש למלא אימייל וקוד בן 6 ספרות",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (signedInEmail && signedInEmail.toLowerCase() === cleanEmail) {
        await claimGuardianInvite(cleanCode);
        toast({ title: "הצטרפת למשפחה!", description: "ברוכים הבאים ל-Kippy" });
        navigate("/home-v2", { replace: true });
        return;
      }

      if (signedInEmail) {
        await supabase.auth.signOut();
      }

      const { data, error } = await supabase.functions.invoke(
        "v2-join-family-by-code",
        { body: { email: cleanEmail, code: cleanCode } },
      );

      if (error || !data?.success) {
        const key = (data as { error?: string } | null)?.error ?? "";
        toast({
          title: "לא ניתן להצטרף",
          description: errorMessages[key] || "האימייל או הקוד שגויים.",
          variant: "destructive",
        });
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.one_time_password,
      });
      if (signInError) {
        toast({
          title: "שגיאה בהתחברות",
          description: "אפשר לנסות שוב בעוד רגע",
          variant: "destructive",
        });
        return;
      }

      await claimGuardianInvite(cleanCode);
      toast({ title: "הצטרפת למשפחה!", description: "ברוכים הבאים ל-Kippy" });
      navigate("/home-v2", { replace: true });
    } catch (err) {
      console.error("[join-family] failed", err);
      toast({
        title: "לא ניתן להצטרף",
        description: "האימייל או הקוד שגויים, או שהקוד פג תוקף.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div
        className="v2-dark flex min-h-screen items-center justify-center"
        dir="rtl"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="v2-dark flex min-h-screen items-center justify-center px-4 py-10"
      dir="rtl"
    >
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              הצטרפות למשפחה ב-Kippy
            </h1>
            <p className="text-sm text-muted-foreground">
              הזינו את האימייל שאליו נשלחה ההזמנה ואת הקוד בן 6 הספרות שקיבלתם.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="join-email">אימייל</Label>
            <Input
              id="join-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="join-code">קוד הצטרפות</Label>
            <Input
              id="join-code"
              inputMode="numeric"
              maxLength={6}
              dir="ltr"
              className="text-center font-mono text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </div>

          <Button
            type="button"
            className="h-11 w-full"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            הצטרפות למשפחה
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            הקוד תקף ל-7 ימים ומיועד לכתובת שאליה נשלח בלבד.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinFamily;

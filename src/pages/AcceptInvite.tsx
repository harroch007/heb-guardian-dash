import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserPlus, CheckCircle2, XCircle } from "lucide-react";

export default function AcceptInvite() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!user) {
    // Redirect to auth with return URL
    const returnUrl = `/accept-invite/${inviteId}`;
    window.location.href = `/auth?redirect=${encodeURIComponent(returnUrl)}`;
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAccept = async () => {
    if (!inviteId) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const { error } = await supabase.rpc("accept_family_invite", {
        p_invite_id: inviteId,
      });

      if (error) {
        setStatus("error");
        if (error.message?.includes("not found") || error.message?.includes("pending")) {
          setErrorMsg("ההזמנה לא נמצאה או שכבר טופלה.");
        } else if (error.message?.includes("email")) {
          setErrorMsg("כתובת האימייל שלך לא תואמת להזמנה.");
        } else {
          setErrorMsg(error.message || "שגיאה בקבלת ההזמנה.");
        }
        return;
      }

      setStatus("success");
      setTimeout(() => navigate("/home-v2"), 2000);
    } catch {
      setStatus("error");
      setErrorMsg("שגיאה בלתי צפויה. נסה שוב.");
    }
  };

  return (
    <div className="homev2-light min-h-screen flex items-center justify-center px-4" dir="rtl">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center space-y-4">
          {status === "success" ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">הצטרפת בהצלחה!</h2>
              <p className="text-sm text-muted-foreground">מעביר אותך לדף הבית...</p>
            </>
          ) : status === "error" ? (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-lg font-bold text-foreground">שגיאה</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate("/home-v2")}>
                חזור לדף הבית
              </Button>
            </>
          ) : (
            <>
              <UserPlus className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-lg font-bold text-foreground">הוזמנת להצטרף למשפחה</h2>
              <p className="text-sm text-muted-foreground">
                לחץ על הכפתור למטה כדי לקבל את ההזמנה ולהצטרף כהורה שותף.
              </p>
              <Button
                onClick={handleAccept}
                disabled={status === "loading"}
                className="w-full gap-2"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                קבל הזמנה
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

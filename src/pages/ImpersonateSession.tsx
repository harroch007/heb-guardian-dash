import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function ImpersonateSession() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "impersonate-tokens") return;

      const { access_token, refresh_token } = event.data;
      if (!access_token || !refresh_token) {
        setError("חסרים טוקנים");
        return;
      }

      try {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (sessionError) throw sessionError;

        sessionStorage.setItem("impersonating", "true");
        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        console.error("Failed to set session:", err);
        setError(err.message || "שגיאה בהגדרת הסשן");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate]);

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center">
      {error ? (
        <div className="text-destructive text-center">
          <p className="text-lg font-semibold">שגיאה</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">מתחבר כהורה...</p>
        </div>
      )}
    </div>
  );
}

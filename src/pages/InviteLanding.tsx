import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, MessageCircle, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Universal Chat invite landing page.
 *
 * Two scenarios:
 *  1. Android handles the deep link directly (App Links) — this page never opens.
 *  2. The link opens in a desktop / mobile browser:
 *     - If user is signed in (parent): we call accept-chat-invite and redirect to /chat-v2/<friendshipId>.
 *     - Otherwise we explain "Open in the Kippy app" and offer install.
 */
export default function InviteLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "needs-app" | "needs-auth" | "accepting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("קישור לא תקין");
      return;
    }

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setStatus("needs-auth");
        return;
      }

      // We're authenticated as a parent in the dashboard. Try to accept.
      setStatus("accepting");
      const { data, error } = await supabase.functions.invoke("accept-chat-invite", {
        body: { token },
      });

      if (error || !data?.success) {
        setStatus("error");
        setErrorMsg(data?.error ?? error?.message ?? "שגיאה לא ידועה");
        return;
      }

      toast.success(`נוספת לצ'אט עם ${data.peer_name ?? "חבר"}`);
      navigate(`/chat-v2/${data.friendship_id}`, { replace: true });
    })();
  }, [token, navigate]);

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border/50 rounded-2xl p-8 text-center space-y-6">
        {status === "loading" || status === "accepting" ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-foreground">מעבד את ההזמנה...</p>
          </div>
        ) : status === "needs-auth" || status === "needs-app" ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">הזמנה לצ'אט בקיפי</h1>
            <p className="text-muted-foreground">
              כדי לפתוח את ההזמנה, פתח את הקישור באפליקציית קיפי במכשיר שלך.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link to="/install">
                  <Smartphone className="ml-2 h-4 w-4" />
                  התקן את אפליקציית קיפי
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/auth">התחבר כהורה</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">לא הצלחנו לפתוח את ההזמנה</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button asChild variant="outline">
              <Link to="/">חזרה לדף הבית</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

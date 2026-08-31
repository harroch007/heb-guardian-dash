import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface ActivationResult {
  activated: boolean;
  otp_sent: boolean;
  otp_delivery: "requested" | "recent_request_exists";
  expires_at: string;
  play_store_url: string;
}

export default function ChildInstallLanding() {
  const { activationToken } = useParams();
  const [result, setResult] = useState<ActivationResult | null>(null);
  const [error, setError] = useState<"link" | "otp" | null>(null);

  useEffect(() => {
    if (!activationToken) {
      setError("link");
      return;
    }
    let redirectTimer: number | undefined;
    void supabase.functions
      .invoke("v2-activate-child-install", {
        body: { activation_token: activationToken },
      })
      .then(({ data, error: activationError }) => {
        if (
          activationError ||
          data?.activated !== true ||
          !data?.play_store_url
        ) {
          setError("link");
          return;
        }
        const activation = data as ActivationResult;
        if (
          activation.otp_delivery !== "requested" &&
          activation.otp_delivery !== "recent_request_exists"
        ) {
          setError("otp");
          return;
        }
        setResult(activation);
        redirectTimer = window.setTimeout(() => {
          window.location.assign(activation.play_store_url);
        }, 1_200);
      })
      .catch(() => setError("link"));
    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [activationToken]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>
            {error ? "לא הצלחנו להשלים את ההפעלה" : "מתקינים את Kippy"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <>
              <TriangleAlert className="mx-auto h-12 w-12 text-destructive" />
              <p className="text-sm text-muted-foreground">
                {error === "otp"
                  ? "לא ניתן לאשר את מצב שליחת קוד האימות. נסו לפתוח שוב את אותו קישור בעוד רגע."
                  : "הקישור לא הופעל. נסו לפתוח אותו שוב; אם פג תוקפו, צרו קישור חדש ממסך ההורה."}
              </p>
            </>
          ) : result ? (
            <>
              <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
              <p className="text-sm text-muted-foreground">
                קוד OTP זמין באימייל של ההורה. לאחר ההתקנה הזינו
                באפליקציה את אימייל ההורה ואת הקוד.
              </p>
              <Button
                className="w-full"
                onClick={() => window.location.assign(result.play_store_url)}
              >
                המשך ל־Google Play
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                מאמתים את קישור ההתקנה…
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

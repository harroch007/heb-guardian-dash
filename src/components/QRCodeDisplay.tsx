import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createChildInstallSession,
  getChildInstallSessionStatus,
  type V2ChildInstallSession,
} from "@/lib/v2/guardianService";

interface QRCodeDisplayProps {
  childId: string;
  parentId: string;
  parentEmail: string;
  onFinish: () => void;
  onConnected?: () => void;
}

export function QRCodeDisplay({
  childId,
  parentEmail,
  onFinish,
  onConnected,
}: QRCodeDisplayProps) {
  const [session, setSession] =
    useState<V2ChildInstallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      setSession(await createChildInstallSession(childId));
    } catch (requestError) {
      console.error("V2 child install session failed:", requestError);
      setError("לא ניתן ליצור קישור התקנה. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void generate();
    // A new session must only be created when the child changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  useEffect(() => {
    const sessionId = session?.install_session_id;
    if (!sessionId) return;

    let stopped = false;

    const stopPolling = () => {
      stopped = true;
      window.clearInterval(timer);
    };

    const checkStatus = async () => {
      try {
        const current = await getChildInstallSessionStatus(sessionId);
        if (stopped || !current) return;

        if (current.status === "consumed") {
          stopPolling();
          toast({
            title: "🎉 המכשיר חובר בהצלחה!",
            description: "Kippy פעילה כעת במכשיר הילד/ה.",
          });
          onConnected?.();
          onFinish();
          return;
        }

        if (current.status === "expired" || current.status === "cancelled") {
          stopPolling();
          setSession(null);
          setError("קישור ההתקנה כבר אינו פעיל. צרו קישור חדש.");
        }
      } catch (statusError) {
        console.warn("V2 child install status check failed:", statusError);
      }
    };

    const timer = window.setInterval(() => void checkStatus(), 5_000);
    void checkStatus();

    return stopPolling;
  }, [onConnected, onFinish, session?.install_session_id, toast]);

  const copyLink = async () => {
    if (!session) return;
    await navigator.clipboard.writeText(session.activation_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || error) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={generate} className="w-full">
          <RefreshCw className="ml-2 h-4 w-4" />
          צור קישור חדש
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4 text-center" dir="rtl">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">
          חיבור מכשיר הילד/ה
        </span>
      </div>

      <div>
        <p className="font-medium">סרקו את הקוד ממכשיר הילד/ה</p>
        <p className="mt-1 text-sm text-muted-foreground">
          הקישור יפתח את דף ההתקנה, ישלח OTP אל {parentEmail},
          ויעביר לחנות Google Play.
        </p>
      </div>

      <div className="inline-block rounded-2xl border border-primary/30 bg-white p-4">
        <QRCodeSVG
          value={session.qr_payload}
          size={220}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#102A43"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        הקישור תקף עד{" "}
        {new Date(session.expires_at).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div className="space-y-2">
        <Button variant="outline" onClick={copyLink} className="h-11 w-full">
          {copied ? (
            <Check className="ml-2 h-4 w-4" />
          ) : (
            <Copy className="ml-2 h-4 w-4" />
          )}
          {copied ? "הקישור הועתק" : "העתק קישור התקנה"}
        </Button>
        <Button variant="ghost" onClick={onFinish} className="h-11 w-full">
          סגור וחבר מאוחר יותר
        </Button>
      </div>
    </div>
  );
}

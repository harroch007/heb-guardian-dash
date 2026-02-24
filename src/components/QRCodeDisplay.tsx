import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Smartphone, Loader2, Copy, Check, ArrowLeft, Download, Mail, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.kippy.safety.core';

interface QRCodeDisplayProps {
  childId: string;
  parentId: string;
  parentEmail: string;
  onFinish: () => void;
}

export function QRCodeDisplay({ childId, parentId, parentEmail, onFinish }: QRCodeDisplayProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate pairing code when moving to step 2
  useEffect(() => {
    if (step !== 2 || pairingCode) return;

    const generateCode = async () => {
      setLoadingCode(true);
      try {
        const { data, error } = await supabase.rpc('generate_pairing_code', {
          p_child_id: childId
        });
        if (error) throw error;
        setPairingCode(data);
      } catch (error) {
        console.error('Error generating pairing code:', error);
        toast({
          title: 'שגיאה',
          description: 'לא ניתן ליצור קוד חיבור',
          variant: 'destructive',
        });
      } finally {
        setLoadingCode(false);
      }
    };

    generateCode();
  }, [step, childId, pairingCode, toast]);

  // Realtime listener for device pairing (step 2 only)
  useEffect(() => {
    if (step !== 2) return;

    const channel = supabase
      .channel(`device-pair-${childId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `child_id=eq.${childId}`,
        },
        () => {
          toast({ title: '🎉 המכשיר חובר בהצלחה!' });
          onFinish();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [step, childId, toast, onFinish]);

  // Copy code to clipboard
  const handleCopy = async () => {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    toast({ title: 'הקוד הועתק!' });
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Step 1: Download App ---
  if (step === 1) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
          <Download className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">שלב 1 — הורדת האפליקציה</span>
        </div>

        <p className="text-muted-foreground mb-6">
          סרקו את הקוד עם מכשיר הילד להורדת אפליקציית KippyAI
        </p>

        {/* QR Code → Play Store */}
        <div className="bg-background p-6 rounded-2xl border border-primary/30 inline-block mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl pointer-events-none" />
          <QRCodeSVG
            value={PLAY_STORE_URL}
            size={200}
            level="H"
            includeMargin
            bgColor="hsl(222, 47%, 6%)"
            fgColor="hsl(180, 100%, 50%)"
          />
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Smartphone className="w-5 h-5" />
            <p className="text-sm">סרקו עם המצלמה של מכשיר הילד</p>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={() => setStep(2)} className="w-full glow-primary" size="lg">
            שלב הבא
          </Button>
          <Button onClick={onFinish} variant="outline" className="w-full" size="lg">
            סגור וחבר מאוחר יותר
          </Button>
        </div>
      </div>
    );
  }

  // --- Step 2: Connect Device ---
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm font-medium text-primary">שלב 2 — ממתין לחיבור מכשיר</span>
      </div>

      <p className="text-muted-foreground mb-6">
        הזינו את האימייל והקוד במסך ההתחברות באפליקציה שבמכשיר הילד
      </p>

      {/* Parent Email */}
      <div className="bg-muted/30 rounded-xl p-4 mb-4 border border-border">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">אימייל ההורה</p>
        </div>
        <p className="text-lg font-medium text-foreground dir-ltr" dir="ltr">
          {parentEmail}
        </p>
      </div>

      {/* Pairing Code */}
      <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border">
        <div className="flex items-center justify-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">קוד חיבור</p>
        </div>

        {loadingCode ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        ) : (
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-mono font-bold tracking-widest text-primary">
              {pairingCode}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground/70 mb-6">
        כאשר המכשיר יתחבר, הדף יתעדכן אוטומטית
      </p>

      <div className="space-y-3">
        <Button onClick={() => setStep(1)} variant="ghost" className="w-full" size="sm">
          <ArrowLeft className="w-4 h-4 ml-2" />
          חזרה לשלב הקודם
        </Button>
        <Button onClick={onFinish} variant="outline" className="w-full" size="lg">
          סגור וחבר מאוחר יותר
        </Button>
      </div>
    </div>
  );
}

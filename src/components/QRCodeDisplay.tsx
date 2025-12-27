import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Smartphone, Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QRCodeDisplayProps {
  childId: string;
  parentId: string;
  onFinish: () => void;
}

export function QRCodeDisplay({ childId, parentId, onFinish }: QRCodeDisplayProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate pairing code on mount
  useEffect(() => {
    const generateCode = async () => {
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
        setLoading(false);
      }
    };

    generateCode();
  }, [childId, toast]);

  // Generate QR URL
  const qrUrl = pairingCode ? `https://kippy.app/pair/${pairingCode}` : '';

  // Copy code to clipboard
  const handleCopy = async () => {
    if (!pairingCode) return;
    
    await navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    toast({ title: 'הקוד הועתק!' });
    
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">יוצר קוד חיבור...</p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      {/* Loading indicator */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-primary">ממתין לחיבור מכשיר...</span>
      </div>

      <p className="text-muted-foreground mb-6">
        סרוק את הקוד עם אפליקציית Kippy במכשיר של הילד
      </p>

      {/* QR Code */}
      <div className="bg-background p-6 rounded-2xl border border-primary/30 inline-block mb-6 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl pointer-events-none" />
        <QRCodeSVG
          value={qrUrl}
          size={200}
          level="H"
          includeMargin
          bgColor="hsl(222, 47%, 6%)"
          fgColor="hsl(180, 100%, 50%)"
        />
      </div>

      {/* Manual Code Entry Section */}
      <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border">
        <p className="text-sm text-muted-foreground mb-3">
          או הזן קוד ידנית:
        </p>
        
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
      </div>

      {/* Instructions */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Smartphone className="w-5 h-5" />
          <p className="text-sm">וודא שהאפליקציה מותקנת במכשיר הילד</p>
        </div>
        <p className="text-xs text-muted-foreground/70">
          המודל ייסגר אוטומטית כאשר המכשיר יחובר
        </p>
      </div>

      <Button onClick={onFinish} variant="outline" className="w-full" size="lg">
        סגור וחבר מאוחר יותר
      </Button>
    </div>
  );
}

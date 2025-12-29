import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, RefreshCw, Smartphone } from 'lucide-react';

interface ReconnectChildModalProps {
  childId: string | null;
  childName: string;
  parentEmail: string;
  onClose: () => void;
}

export function ReconnectChildModal({ childId, childName, parentEmail, onClose }: ReconnectChildModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = async () => {
    if (!childId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_new_pairing_code', {
        p_child_id: childId
      });
      
      if (rpcError) throw rpcError;
      
      const result = data as { success: boolean; code: string; error?: string };
      if (!result.success) throw new Error(result.error);
      
      setCode(result.code);
    } catch (err: any) {
      setError('שגיאה ביצירת קוד חדש');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCode(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={!!childId} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            חיבור מחדש - {childName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!code ? (
            <>
              <p className="text-sm text-muted-foreground">
                לחץ על הכפתור כדי לייצר קוד חיבור חדש בן 6 ספרות.
                <br />
                <span className="text-warning">שים לב: פעולה זו תנתק את המכשיר הנוכחי.</span>
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {error}
                </div>
              )}
              
              <Button 
                onClick={generateCode} 
                disabled={loading}
                className="w-full gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'מייצר...' : 'צור קוד חדש'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                הורד את האפליקציה במכשיר של הילד והזן:
              </p>

              <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">אימייל:</span>
                  <span className="font-medium text-foreground">{parentEmail}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">קוד:</span>
                  <span className="font-mono text-2xl font-bold tracking-widest text-primary">
                    {code}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                הקוד תקף ל-24 שעות
              </p>

              <Button 
                onClick={copyCode} 
                variant="outline"
                className="w-full gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'הועתק!' : 'העתק קוד'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

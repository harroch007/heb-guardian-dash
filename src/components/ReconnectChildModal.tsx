import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, RefreshCw, Smartphone, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface DisconnectedDevice {
  device_id: string;
  device_model: string | null;
  device_manufacturer: string | null;
  last_seen: string | null;
}

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
  const [disconnectedDevices, setDisconnectedDevices] = useState<DisconnectedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showNewDeviceFlow, setShowNewDeviceFlow] = useState(false);

  // Fetch disconnected devices when modal opens
  useEffect(() => {
    if (!childId) {
      setDisconnectedDevices([]);
      setShowNewDeviceFlow(false);
      setCode(null);
      setError(null);
      return;
    }

    const fetchDisconnectedDevices = async () => {
      setLoadingDevices(true);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_disconnected_devices', {
          p_child_id: childId
        });
        if (!rpcError && data) {
          setDisconnectedDevices(data as DisconnectedDevice[]);
        }
      } catch {
        // Silently fail — just show the OTP flow
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDisconnectedDevices();
  }, [childId]);

  const reconnectDevice = async (deviceId: string) => {
    if (!childId) return;
    setReconnecting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('reconnect_device', {
        p_child_id: childId,
        p_device_id: deviceId
      });

      if (rpcError) throw rpcError;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'UNKNOWN_ERROR');
      }

      toast.success('המכשיר חובר מחדש בהצלחה!');
      onClose();
    } catch (err: any) {
      setError('שגיאה בחיבור מחדש של המכשיר');
      console.error(err);
    } finally {
      setReconnecting(false);
    }
  };

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
    setShowNewDeviceFlow(false);
    setDisconnectedDevices([]);
    onClose();
  };

  const getDeviceLabel = (device: DisconnectedDevice) => {
    if (device.device_model) {
      return device.device_manufacturer 
        ? `${device.device_manufacturer} ${device.device_model}`
        : device.device_model;
    }
    return device.device_id.slice(0, 8) + '...';
  };

  const hasDisconnectedDevices = disconnectedDevices.length > 0;
  const showQuickReconnect = hasDisconnectedDevices && !showNewDeviceFlow && !code;

  return (
    <Dialog open={!!childId} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            חיבור מכשיר - {childName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {loadingDevices ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : showQuickReconnect ? (
            <>
              {/* Quick Reconnect Section */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  זוהה מכשיר שהיה מחובר בעבר. ניתן לחבר אותו מחדש בלחיצה אחת:
                </p>

                {disconnectedDevices.map((device) => (
                  <div 
                    key={device.device_id}
                    className="p-4 rounded-lg bg-muted/50 border border-border space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
                        <Smartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {getDeviceLabel(device)}
                        </p>
                        {device.last_seen && (
                          <p className="text-xs text-muted-foreground">
                            נראה לאחרונה: {new Date(device.last_seen).toLocaleDateString('he-IL')}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => reconnectDevice(device.device_id)}
                      disabled={reconnecting}
                      className="w-full gap-2"
                    >
                      <LinkIcon className={`w-4 h-4 ${reconnecting ? 'animate-spin' : ''}`} />
                      {reconnecting ? 'מחבר...' : 'חבר מחדש'}
                    </Button>
                  </div>
                ))}

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">או</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowNewDeviceFlow(true)}
                  className="w-full gap-2 text-sm"
                >
                  <Smartphone className="w-4 h-4" />
                  חבר מכשיר חדש
                </Button>
              </div>
            </>
          ) : !code ? (
            <>
              {/* OTP Flow */}
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

              {hasDisconnectedDevices && showNewDeviceFlow && (
                <Button
                  variant="ghost"
                  onClick={() => setShowNewDeviceFlow(false)}
                  className="w-full text-sm text-muted-foreground"
                >
                  ← חזרה לחיבור מחדש
                </Button>
              )}
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

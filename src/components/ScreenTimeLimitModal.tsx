import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ScreenTimeLimitModalProps {
  childId: string;
  childName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLimit: number | null;
  onUpdated: (newLimit: number | null) => void;
}

export function ScreenTimeLimitModal({ 
  childId, 
  childName, 
  open, 
  onOpenChange, 
  currentLimit,
  onUpdated 
}: ScreenTimeLimitModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [limitEnabled, setLimitEnabled] = useState(currentLimit !== null);
  const [hours, setHours] = useState(currentLimit ? Math.floor(currentLimit / 60) : 2);
  const [minutes, setMinutes] = useState(currentLimit ? currentLimit % 60 : 0);

  useEffect(() => {
    setLimitEnabled(currentLimit !== null);
    setHours(currentLimit ? Math.floor(currentLimit / 60) : 2);
    setMinutes(currentLimit ? currentLimit % 60 : 0);
  }, [currentLimit, open]);

  const handleSave = async () => {
    setSaving(true);

    const totalMinutes = limitEnabled ? (hours * 60 + minutes) : null;

    // Check if settings exist for this child
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('id')
      .eq('child_id', childId)
      .maybeSingle();

    let error;

    if (existingSettings) {
      // Update existing settings
      const result = await supabase
        .from('settings')
        .update({ daily_screen_time_limit_minutes: totalMinutes })
        .eq('child_id', childId);
      error = result.error;
    } else {
      // Insert new settings
      const result = await supabase
        .from('settings')
        .insert({ 
          child_id: childId,
          daily_screen_time_limit_minutes: totalMinutes 
        });
      error = result.error;
    }

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשמור את הגבלת זמן המסך',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    toast({
      title: limitEnabled ? 'הגבלה נשמרה' : 'הגבלה בוטלה',
      description: limitEnabled 
        ? `הגבלת זמן מסך של ${hours}ש' ${minutes > 0 ? `${minutes}ד'` : ''} נקבעה`
        : 'הגבלת זמן המסך בוטלה',
    });

    onUpdated(totalMinutes);
    onOpenChange(false);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הגבלת זמן מסך</DialogTitle>
          <DialogDescription>
            הגדר מגבלת זמן מסך יומית עבור {childName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="limit-enabled" className="text-base">
              הפעל הגבלת זמן מסך
            </Label>
            <Switch
              id="limit-enabled"
              checked={limitEnabled}
              onCheckedChange={setLimitEnabled}
            />
          </div>

          {/* Time Inputs */}
          {limitEnabled && (
            <div className="space-y-4 animate-fade-in">
              <Label>מגבלה יומית</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="hours" className="text-xs text-muted-foreground">שעות</Label>
                  <Input
                    id="hours"
                    type="number"
                    min={0}
                    max={12}
                    value={hours}
                    onChange={(e) => setHours(Math.min(12, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="text-center text-lg"
                  />
                </div>
                <span className="text-2xl text-muted-foreground mt-4">:</span>
                <div className="flex-1">
                  <Label htmlFor="minutes" className="text-xs text-muted-foreground">דקות</Label>
                  <Input
                    id="minutes"
                    type="number"
                    min={0}
                    max={59}
                    step={15}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="text-center text-lg"
                  />
                </div>
              </div>
              
              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '1 שעה', h: 1, m: 0 },
                  { label: '1.5 שעות', h: 1, m: 30 },
                  { label: '2 שעות', h: 2, m: 0 },
                  { label: '3 שעות', h: 3, m: 0 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHours(preset.h);
                      setMinutes(preset.m);
                    }}
                    className={hours === preset.h && minutes === preset.m ? 'border-primary bg-primary/10' : ''}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving || (limitEnabled && hours === 0 && minutes === 0)}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

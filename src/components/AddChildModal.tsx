import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { Loader2, CalendarIcon, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface AddChildModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChildAdded: () => void;
}

const childSchema = z.object({
  name: z.string().min(2, 'השם חייב להכיל לפחות 2 תווים').max(100),
  dateOfBirth: z.date({ required_error: 'נא לבחור תאריך לידה' }),
  gender: z.enum(['boy', 'girl', 'other'], { required_error: 'נא לבחור מין' }),
});

export function AddChildModal({ open, onOpenChange, onChildAdded }: AddChildModalProps) {
  const [step, setStep] = useState<'form' | 'pairing'>('form');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [gender, setGender] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [childId, setChildId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const resetForm = () => {
    setName('');
    setDateOfBirth(undefined);
    setGender('');
    setErrors({});
    setStep('form');
    setChildId(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateForm = () => {
    try {
      childSchema.parse({
        name,
        dateOfBirth,
        gender: gender as 'boy' | 'girl' | 'other',
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user || !dateOfBirth) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.from('children').insert({
        parent_id: user.id,
        name: name.trim(),
        phone_number: '', // Will be set during pairing
        date_of_birth: format(dateOfBirth, 'yyyy-MM-dd'),
        gender,
      }).select('id').single();

      if (error) {
        console.error('Error adding child:', error);
        toast({
          title: 'שגיאה',
          description: 'לא ניתן להוסיף את הילד',
          variant: 'destructive',
        });
        return;
      }

      setChildId(data.id);
      setStep('pairing');
      onChildAdded();
    } finally {
      setLoading(false);
    }
  };

  // Listen for device pairing in real-time
  useEffect(() => {
    if (!childId || step !== 'pairing') return;

    const channel = supabase
      .channel(`device-pairing-${childId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          console.log('Device paired!', payload);
          toast({
            title: '🎉 המכשיר חובר בהצלחה!',
            description: 'המכשיר של הילד מחובר כעת למערכת',
          });
          handleClose();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId, step]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card/95 backdrop-blur-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            {step === 'form' ? 'הוספת ילד חדש' : 'חיבור מכשיר'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">שם הילד *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="שם הילד"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pr-10"
                />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label>תאריך לידה *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right",
                      !dateOfBirth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {dateOfBirth ? format(dateOfBirth, 'dd/MM/yyyy') : 'בחר תאריך'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateOfBirth}
                    onSelect={setDateOfBirth}
                    disabled={(date) => date > new Date() || date < new Date('1990-01-01')}
                    initialFocus
                    locale={he}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth}</p>}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>מין *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מין" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boy">בן</SelectItem>
                  <SelectItem value="girl">בת</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender}</p>}
            </div>

            <Button
              type="submit"
              className="w-full glow-primary mt-6"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              המשך לחיבור מכשיר
            </Button>
          </form>
        ) : (
          <QRCodeDisplay 
            childId={childId!} 
            parentId={user?.id || ''} 
            onFinish={handleClose} 
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

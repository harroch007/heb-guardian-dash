import { useState } from 'react';
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
import { Loader2, CalendarIcon, User, Phone, MapPin, GraduationCap } from 'lucide-react';
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
  phoneNumber: z.string().min(9, 'מספר טלפון לא תקין').max(15),
  dateOfBirth: z.date({ required_error: 'נא לבחור תאריך לידה' }),
  gender: z.enum(['boy', 'girl', 'other'], { required_error: 'נא לבחור מין' }),
  city: z.string().optional(),
  school: z.string().optional(),
});

export function AddChildModal({ open, onOpenChange, onChildAdded }: AddChildModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [gender, setGender] = useState<string>('');
  const [city, setCity] = useState('');
  const [school, setSchool] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setDateOfBirth(undefined);
    setGender('');
    setCity('');
    setSchool('');
    setErrors({});
    setStep('form');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateForm = () => {
    try {
      childSchema.parse({
        name,
        phoneNumber,
        dateOfBirth,
        gender: gender as 'boy' | 'girl' | 'other',
        city: city || undefined,
        school: school || undefined,
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
      const { error } = await supabase.from('children').insert({
        parent_id: user.id,
        name: name.trim(),
        phone_number: phoneNumber.trim(),
        date_of_birth: format(dateOfBirth, 'yyyy-MM-dd'),
        gender,
        city: city.trim() || null,
        school: school.trim() || null,
      });

      if (error) {
        console.error('Error adding child:', error);
        toast({
          title: 'שגיאה',
          description: 'לא ניתן להוסיף את הילד',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'הילד נוסף בהצלחה!',
        description: `${name} נוסף למשפחה שלך`,
      });
      
      setStep('success');
      onChildAdded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card/95 backdrop-blur-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            {step === 'form' ? 'הוספת ילד חדש' : 'הילד נוסף בהצלחה!'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">שם *</Label>
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

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">מספר טלפון *</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="050-1234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="pr-10"
                  dir="ltr"
                />
              </div>
              {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber}</p>}
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

            {/* City (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="city">עיר (אופציונלי)</Label>
              <div className="relative">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="city"
                  type="text"
                  placeholder="תל אביב"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            {/* School (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="school">בית ספר (אופציונלי)</Label>
              <div className="relative">
                <GraduationCap className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="school"
                  type="text"
                  placeholder="שם בית הספר"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full glow-primary mt-6"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              הוסף ילד
            </Button>
          </form>
        ) : (
          <QRCodeDisplay onFinish={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

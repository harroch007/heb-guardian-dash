import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { bootstrapGuardian } from '@/lib/v2/guardianService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, User, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const profileSchema = z.object({
  fullName: z.string().min(2, 'השם חייב להכיל לפחות 2 תווים').max(100, 'השם ארוך מדי'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[0-9+()\-\s]{9,20}$/.test(value),
      'מספר טלפון לא תקין',
    ),
});

export default function Onboarding() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const { user, checkParentStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = () => {
    try {
      profileSchema.parse({ fullName, phone });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { fullName?: string; phone?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'fullName') newErrors.fullName = err.message;
          if (err.path[0] === 'phone') newErrors.phone = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) return;

    setLoading(true);

    try {
      await bootstrapGuardian({
        displayName: fullName,
        phone: phone.trim() || null,
      });

      await checkParentStatus();
      
      toast({
        title: 'הפרופיל נשמר בהצלחה!',
        description: 'ברוך הבא למרכז הבטיחות',
      });
      
      navigate('/home-v2');
    } catch (error) {
      console.error('Error bootstrapping V2 guardian:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשמור את הפרופיל. נסו שוב.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-primary/10 glow-primary animate-glow-pulse mb-4">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground text-glow">ברוך הבא!</h1>
          <p className="text-muted-foreground mt-2">בואו נשלים את הפרופיל שלך</p>
        </div>

        <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">השלמת פרופיל</CardTitle>
            <CardDescription>
              מלא את הפרטים הבאים כדי להמשיך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">שם מלא *</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="ישראל ישראלי"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 pr-10"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">מספר טלפון (אופציונלי)</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="050-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 pr-10"
                    dir="ltr"
                  />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              <Button
                type="submit"
                className="h-11 w-full glow-primary mt-6"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : null}
                המשך למרכז הבטיחות
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

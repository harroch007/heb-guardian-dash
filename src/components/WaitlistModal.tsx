import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWaitlist } from '@/contexts/WaitlistContext';
import { supabase } from '@/integrations/supabase/client';
import { User, Mail, Phone, Calendar, Smartphone, MapPin, MessageCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import kippyLogo from '@/assets/kippy-logo.svg';

const regions = [
  { value: 'center', label: 'מרכז' },
  { value: 'sharon', label: 'שרון' },
  { value: 'north', label: 'צפון' },
  { value: 'jerusalem', label: 'ירושלים והסביבה' },
  { value: 'lowlands', label: 'שפלה' },
  { value: 'south', label: 'דרום' },
  { value: 'abroad', label: 'חו״ל' },
];

const referralSources = [
  { value: 'tv_press', label: 'טלויזיה או עיתונות' },
  { value: 'websites', label: 'אתרי אינטרנט' },
  { value: 'friends', label: 'חברים' },
  { value: 'search', label: 'חיפוש' },
  { value: 'other', label: 'אחר' },
];

interface FormData {
  parentName: string;
  email: string;
  phone: string;
  childAge: string;
  deviceOs: 'android' | 'iphone' | '';
  region: string;
  referralSource: string;
  referralOther: string;
}

interface FormErrors {
  parentName?: string;
  email?: string;
  phone?: string;
  childAge?: string;
  deviceOs?: string;
}

export function WaitlistModal() {
  const { isModalOpen, closeModal } = useWaitlist();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    parentName: '',
    email: '',
    phone: '',
    childAge: '',
    deviceOs: '',
    region: '',
    referralSource: '',
    referralOther: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.parentName.trim()) {
      newErrors.parentName = 'חובה למלא שדה זה';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'חובה למלא שדה זה';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'אימייל לא תקין';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'חובה למלא שדה זה';
    } else if (!/^05\d{8}$/.test(formData.phone.replace(/-/g, ''))) {
      newErrors.phone = 'מספר טלפון לא תקין';
    }

    if (!formData.childAge) {
      newErrors.childAge = 'חובה למלא שדה זה';
    } else {
      const age = parseInt(formData.childAge);
      if (isNaN(age) || age < 4 || age > 18) {
        newErrors.childAge = 'נא להזין גיל בין 4 ל-18';
      }
    }

    if (!formData.deviceOs) {
      newErrors.deviceOs = 'חובה לבחור מערכת הפעלה';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('waitlist_signups').insert({
        parent_name: formData.parentName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.replace(/-/g, ''),
        child_age: parseInt(formData.childAge),
        device_os: formData.deviceOs,
        region: formData.region || null,
        referral_source: formData.referralSource || null,
        referral_other: formData.referralSource === 'other' ? formData.referralOther : null,
      });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - email already exists
          setErrors({ email: 'האימייל הזה כבר רשום ברשימת ההמתנה' });
        } else {
          throw error;
        }
      } else {
        setIsSuccess(true);
      }
    } catch (error) {
      console.error('Error submitting waitlist form:', error);
      setErrors({ email: 'אירעה שגיאה, נסה שוב' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    closeModal();
    // Reset form after animation
    setTimeout(() => {
      setIsSuccess(false);
      setFormData({
        parentName: '',
        email: '',
        phone: '',
        childAge: '',
        deviceOs: '',
        region: '',
        referralSource: '',
        referralOther: '',
      });
      setErrors({});
    }, 300);
  };

  const isFormValid = 
    formData.parentName.trim() &&
    formData.email.trim() &&
    formData.phone.trim() &&
    formData.childAge &&
    formData.deviceOs;

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-primary/30 shadow-[0_0_30px_rgba(0,255,255,0.1)]" dir="rtl">
        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">נרשמת בהצלחה</h3>
            <p className="text-muted-foreground mb-6">
              נעדכן אותך כשייפתח מקום לגישה.
            </p>
            <Button onClick={handleClose} className="px-8">
              סגור
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
                <span className="text-xl font-bold text-primary">KippyAI</span>
              </div>
              <DialogTitle className="text-xl font-bold">
                הצטרפות לרשימת ההמתנה של KippyAI
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-3">
                אנחנו פותחים גישה בהדרגה למעגלים קטנים כדי לוודא חוויה בטוחה ומדויקת.
                השאירו פרטים ונעדכן כשייפתח מקום לגישה.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                אין ספאם, ניתן להסיר בכל רגע.
              </p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Parent Name */}
              <div className="space-y-2">
                <Label htmlFor="parentName" className="text-sm font-medium">
                  שם ההורה <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="parentName"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="איך לפנות אליך?"
                    className={cn(
                      'pr-10 bg-muted/50',
                      errors.parentName && 'border-destructive'
                    )}
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {errors.parentName && (
                  <p className="text-xs text-destructive">{errors.parentName}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  אימייל <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    className={cn(
                      'pr-10 bg-muted/50',
                      errors.email && 'border-destructive'
                    )}
                    dir="ltr"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  מספר טלפון (הורה) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="05X-XXXXXXX"
                    className={cn(
                      'pr-10 bg-muted/50',
                      errors.phone && 'border-destructive'
                    )}
                    dir="ltr"
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>

              {/* Child Age */}
              <div className="space-y-2">
                <Label htmlFor="childAge" className="text-sm font-medium">
                  גיל הילד.ה <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="childAge"
                    type="number"
                    min="4"
                    max="18"
                    value={formData.childAge}
                    onChange={(e) => setFormData({ ...formData, childAge: e.target.value })}
                    placeholder="4-18"
                    className={cn(
                      'pr-10 bg-muted/50',
                      errors.childAge && 'border-destructive'
                    )}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {errors.childAge && (
                  <p className="text-xs text-destructive">{errors.childAge}</p>
                )}
              </div>

              {/* Device OS */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  מערכת הטלפון של הילד.ה <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deviceOs: 'android' })}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all',
                      formData.deviceOs === 'android'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="font-medium">Android</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deviceOs: 'iphone' })}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all',
                      formData.deviceOs === 'iphone'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span className="font-medium">iPhone</span>
                  </button>
                </div>
                {errors.deviceOs && (
                  <p className="text-xs text-destructive">{errors.deviceOs}</p>
                )}
              </div>

              {/* Region (optional) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  אזור מגורים
                </Label>
                <Select
                  value={formData.region}
                  onValueChange={(value) => setFormData({ ...formData, region: value })}
                >
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue placeholder="בחר אזור" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Referral Source (optional) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  איך שמעת על קיפי?
                </Label>
                <Select
                  value={formData.referralSource}
                  onValueChange={(value) => setFormData({ ...formData, referralSource: value })}
                >
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue placeholder="בחר אפשרות" />
                  </SelectTrigger>
                  <SelectContent>
                    {referralSources.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {formData.referralSource === 'other' && (
                  <Input
                    value={formData.referralOther}
                    onChange={(e) => setFormData({ ...formData, referralOther: e.target.value })}
                    placeholder="פרט/י איך..."
                    className="mt-2 bg-muted/50"
                  />
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full py-6 text-lg glow-primary"
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? 'שולח...' : 'הצטרפתי לרשימה'}
              </Button>

              {/* Privacy Text */}
              <p className="text-xs text-muted-foreground/70 text-center leading-relaxed">
                בלחיצה על "הצטרפתי לרשימה" אני מסכימ/ה לקבל עדכונים על גישה מוקדמת.
                <br />
                הפרטים נשמרים לצורך יצירת קשר בלבד ולא מועברים לצדדים שלישיים.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

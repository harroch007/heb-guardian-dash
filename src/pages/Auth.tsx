import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import kippyLogo from '@/assets/kippy-logo.png';

const authSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'הסיסמה חייבת להכיל לפחות 6 תווים'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(() => searchParams.get('signup') !== 'true');
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; terms?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('signup') === 'true') {
      setIsLogin(false);
    }
  }, [searchParams]);

  const validateForm = () => {
    try {
      if (isResetPassword) {
        resetPasswordSchema.parse({ email });
      } else {
        authSchema.parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'email') newErrors.email = err.message;
          if (err.path[0] === 'password') newErrors.password = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast({
          title: 'שגיאה',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'נשלח בהצלחה!',
        description: 'בדוק את האימייל שלך לקישור לאיפוס הסיסמה',
      });
      setIsResetPassword(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isLogin && !agreedToTerms) {
      setErrors({ terms: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות' });
      return;
    }
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: 'שגיאה',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (!isLogin && !agreedToTerms) {
      setErrors(prev => ({ ...prev, terms: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות' }));
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'שגיאה בהתחברות',
              description: 'אימייל או סיסמה שגויים',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'שגיאה',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }

        toast({
          title: 'התחברת בהצלחה!',
          description: 'ברוך הבא למרכז הבטיחות',
        });
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'המשתמש כבר קיים',
              description: 'נסה להתחבר עם הפרטים הקיימים',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'שגיאה',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }

        toast({
          title: 'נרשמת בהצלחה!',
          description: 'בדוק את האימייל שלך לאישור החשבון',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset password view
  if (isResetPassword) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-center">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={kippyLogo} alt="Kippy" className="h-9 w-auto" />
              <span className="text-2xl font-bold text-primary">Kippy</span>
            </Link>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">

          <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">איפוס סיסמה</CardTitle>
              <CardDescription>הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">אימייל</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pr-10 text-right"
                      dir="ltr"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full glow-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : null}
                  שלח קישור לאיפוס
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(false);
                    setErrors({});
                  }}
                  className="text-primary hover:underline text-sm"
                >
                  חזור להתחברות
                </button>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={kippyLogo} alt="Kippy" className="h-9 w-auto" />
            <span className="text-2xl font-bold text-primary">Kippy</span>
          </Link>
        </div>
      </header>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">

        <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isLogin ? 'התחברות' : 'הרשמה'}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'הזן את פרטי החשבון שלך' : 'צור חשבון חדש'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign In - show for both login and signup */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {isLogin ? 'התחבר עם Google' : 'הירשם עם Google'}
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-10 text-right"
                    dir="ltr"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              {isLogin && (
                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPassword(true);
                      setErrors({});
                    }}
                    className="text-primary hover:underline text-sm"
                  >
                    שכחת סיסמה?
                  </button>
                </div>
              )}

              {!isLogin && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => {
                        setAgreedToTerms(checked === true);
                        if (checked) setErrors(prev => ({ ...prev, terms: undefined }));
                      }}
                    />
                    <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                      קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" className="text-primary hover:underline">תנאי השימוש</a> ול<a href="/privacy" target="_blank" className="text-primary hover:underline">מדיניות הפרטיות</a>
                    </label>
                  </div>
                  {errors.terms && (
                    <p className="text-sm text-destructive">{errors.terms}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full glow-primary"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : null}
                {isLogin ? 'התחבר' : 'הרשם'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-primary hover:underline text-sm"
              >
                {isLogin ? 'אין לך חשבון? הרשם עכשיו' : 'יש לך חשבון? התחבר'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          בהמשך השימוש אתה מסכים ל
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">תנאי השימוש</a>
          {' '}ו
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">מדיניות הפרטיות</a>
        </p>
        </div>
      </div>
    </div>
  );
}
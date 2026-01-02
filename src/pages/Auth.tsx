import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import kippyLogo from '@/assets/kippy-logo.svg';
import { z } from 'zod';
import { WAITLIST_MODE } from '@/config/featureFlags';

// Validation schemas
const emailSchema = z.string().email('כתובת אימייל לא תקינה');
const passwordSchema = z.string().min(6, 'הסיסמה חייבת להכיל לפחות 6 תווים');
const nameSchema = z.string().min(2, 'השם חייב להכיל לפחות 2 תווים');
const resetEmailSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  // In waitlist mode, force login only (ignore signup param)
  const [isLogin, setIsLogin] = useState(() => WAITLIST_MODE ? true : searchParams.get('signup') !== 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Check if email is allowed and redirect if already logged in
  useEffect(() => {
    const checkUserAccess = async () => {
      if (!authLoading && user) {
        // In waitlist mode, verify user's email is in allowed list
        if (WAITLIST_MODE && user.email) {
          const { data: isAllowed, error } = await supabase
            .rpc('is_email_allowed', { p_email: user.email });
          
          if (error || !isAllowed) {
            // Not allowed - sign out and show error
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "גישה נדחתה",
              description: "האימייל שלך לא נמצא ברשימת המורשים. הצטרף לרשימת ההמתנה.",
            });
            navigate('/');
            return;
          }
        }
        navigate('/dashboard');
      }
    };
    
    checkUserAccess();
  }, [user, authLoading, navigate, toast]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; name?: string } = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (!isLogin) {
      try {
        nameSchema.parse(fullName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.name = e.errors[0].message;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        // Signup is disabled in waitlist mode - this should not be reachable
        // but we keep the logic as a fallback
        if (WAITLIST_MODE) {
          toast({
            variant: "destructive",
            title: "הרשמה סגורה",
            description: "כרגע ההרשמה אפשרית רק דרך רשימת ההמתנה",
          });
          return;
        }
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "נרשמת בהצלחה!",
          description: "בדוק את האימייל שלך לאישור החשבון",
        });
      }
    } catch (error: any) {
      let errorMessage = error.message;
      
      // Translate common error messages to Hebrew
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'אימייל או סיסמה שגויים';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'האימייל לא אושר. בדוק את תיבת הדואר שלך';
      } else if (error.message.includes('User already registered')) {
        errorMessage = 'משתמש עם אימייל זה כבר קיים';
      }
      
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      resetEmailSchema.parse({ email: resetEmail });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "שגיאה",
          description: error.errors[0].message,
        });
        return;
      }
    }

    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      
      if (error) throw error;
      
      setResetSuccess(true);
      toast({
        title: "נשלח בהצלחה!",
        description: "קישור לאיפוס סיסמה נשלח לאימייל שלך",
      });
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.message.includes('Email rate limit exceeded')) {
        errorMessage = 'יותר מדי בקשות. נסה שוב מאוחר יותר';
      }
      
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: errorMessage,
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: error.message,
      });
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Reset password view
  if (isResetPassword) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-center">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={kippyLogo} alt="Kippy" className="h-8" />
            </Link>
          </div>
        </header>
        
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
              <button
                onClick={() => {
                  setIsResetPassword(false);
                  setResetSuccess(false);
                  setResetEmail('');
                }}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>חזרה להתחברות</span>
              </button>

              <h1 className="text-2xl font-bold text-foreground text-right mb-2">
                איפוס סיסמה
              </h1>
              <p className="text-muted-foreground text-right mb-6">
                הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
              </p>

              {resetSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    בדוק את האימייל שלך
                  </h2>
                  <p className="text-muted-foreground">
                    שלחנו קישור לאיפוס סיסמה ל-{resetEmail}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-right block">אימייל</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10 text-left"
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        שולח...
                      </>
                    ) : (
                      'שלח קישור לאיפוס'
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={kippyLogo} alt="Kippy" className="h-8" />
          </Link>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              {isLogin ? 'התחברות' : 'הרשמה'}
            </h1>
            <p className="text-muted-foreground text-center mb-6">
              {isLogin ? 'שמחים לראות אותך שוב!' : 'הצטרפו למשפחת Kippy'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-right block">שם מלא</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="ישראל ישראלי"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`pl-10 text-right ${errors.name ? 'border-destructive' : ''}`}
                      required
                    />
                  </div>
                  {errors.name && (
                    <p className="text-destructive text-sm text-right">{errors.name}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-right block">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`pl-10 text-left ${errors.email ? 'border-destructive' : ''}`}
                    dir="ltr"
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-destructive text-sm text-right">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-right block">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-10 text-left ${errors.password ? 'border-destructive' : ''}`}
                    dir="ltr"
                    required
                  />
                </div>
                {errors.password && (
                  <p className="text-destructive text-sm text-right">{errors.password}</p>
                )}
              </div>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => setIsResetPassword(true)}
                  className="text-sm text-primary hover:underline text-right block w-full"
                >
                  שכחת סיסמה?
                </button>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    {isLogin ? 'מתחבר...' : 'נרשם...'}
                  </>
                ) : (
                  isLogin ? 'התחבר' : 'הרשם'
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleAuth}
            >
              <svg className="h-4 w-4 ml-2" viewBox="0 0 24 24">
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
              המשך עם Google
            </Button>

            {/* Only show toggle if not in waitlist mode */}
            {!WAITLIST_MODE && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                {isLogin ? 'אין לך חשבון?' : 'יש לך כבר חשבון?'}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline mr-1"
                >
                  {isLogin ? 'הרשם עכשיו' : 'התחבר'}
                </button>
              </p>
            )}
            
            {/* Show waitlist info when in waitlist mode */}
            {WAITLIST_MODE && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                אין לך חשבון?{' '}
                <Link to="/" className="text-primary hover:underline">
                  הצטרף לרשימת ההמתנה
                </Link>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
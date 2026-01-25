import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import kippyLogo from "@/assets/kippy-logo.svg";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Sign in with email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("אימייל או סיסמה שגויים");
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

      if (adminError || !isAdmin) {
        // Sign out and show error
        await supabase.auth.signOut();
        setError("אין לך הרשאת גישה לדשבורד זה");
        setLoading(false);
        return;
      }

      // Success - redirect to admin dashboard
      toast.success("התחברת בהצלחה");
      navigate("/admin");
    } catch (err) {
      console.error("Login error:", err);
      setError("אירעה שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      dir="rtl" 
      className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <img src={kippyLogo} alt="Kippy" className="w-12 h-12" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              דשבורד ניהול
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              גישה למורשים בלבד
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={loading}
                className="text-right"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="text-right"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full gap-2" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מתחבר...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  התחבר
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

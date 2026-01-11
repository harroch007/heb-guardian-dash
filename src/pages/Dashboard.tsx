import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, CheckCircle2, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Child {
  id: string;
  name: string;
  parent_id: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("id, name, parent_id")
        .eq("parent_id", user?.id)
        .order("created_at", { ascending: false });

      if (childrenError) throw childrenError;
      setChildren(childrenData || []);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "שגיאה בטעינת נתונים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
        {/* Personalized Greeting */}
        <DashboardGreeting />

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
            <p className="font-medium">שגיאה בטעינת נתונים</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="h-48 rounded-2xl bg-card/50 animate-pulse border border-border/30" />
        ) : children.length > 0 ? (
          <div className="space-y-6 animate-fade-in">
            {/* Hero Card - State A: Calm Day */}
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5 rounded-2xl">
              <CardContent className="p-8 sm:p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  היום עבר בצורה תקינה
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                  קיפי לא זיהה מצבים שדורשים התערבות הורית
                </p>
              </CardContent>
            </Card>

            {/* Hero Card - State B: Attention Needed (commented for reference)
            <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-400/20 shadow-lg shadow-orange-500/5 rounded-2xl">
              <CardContent className="p-8 sm:p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-orange-500/15 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  יש נושא אחד שכדאי לשים לב אליו
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-4">
                  קיפי הכין לך הסבר ברור ולא שיפוטי
                </p>
                <span className="text-orange-500 font-medium cursor-pointer hover:underline">
                  לצפייה
                </span>
              </CardContent>
            </Card>
            */}

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/family")}
            >
              <Users className="w-4 h-4 ml-2" />
              לניהול המשפחה
            </Button>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-card border border-border/50 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground mb-4">אין ילדים רשומים</p>
            <Button onClick={() => navigate("/family")} className="gap-2">
              <Plus className="w-4 h-4" />
              הוסף ילד
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Index;

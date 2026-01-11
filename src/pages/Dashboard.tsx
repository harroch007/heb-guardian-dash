import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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
          <div className="h-24 rounded-xl bg-card/50 animate-pulse border border-border/30" />
        ) : children.length > 0 ? (
          <div className="space-y-4 animate-fade-in">
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
          <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
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

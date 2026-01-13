import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, CheckCircle2, Eye, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Child {
  id: string;
  name: string;
  parent_id: string;
  date_of_birth: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const [selectedChildId, setSelectedChildId] = useState<string>("");

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("id, name, parent_id, date_of_birth")
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
            {/* Child Selector - shown only when more than 1 child */}
            {children.length > 1 && selectedChild && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">מציג נתונים עבור:</span>
                <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                  <SelectTrigger className="w-auto min-w-[140px] h-9 px-3 rounded-full bg-card border-border/50 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="bg-muted">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {selectedChild.name}
                        {selectedChild.date_of_birth && ` (${calculateAge(selectedChild.date_of_birth)})`}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="bg-muted">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {child.name}
                            {child.date_of_birth && ` (${calculateAge(child.date_of_birth)})`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Hero Card - State A: Calm Day */}
            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20 shadow-lg shadow-success/5 rounded-2xl">
              <CardContent className="p-8 sm:p-10 text-center relative">
                {/* Small family management link - top right */}
                <button 
                  onClick={() => navigate("/family")}
                  className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ניהול משפחה
                </button>
                
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  היום עבר בצורה תקינה*
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6">
                  קיפי לא זיהה מצבים שדורשים התערבות הורית*
                </p>
                
                {/* Subtle CTA */}
                <button 
                  onClick={() => navigate(`/daily-report/${selectedChildId}`)}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  לצפייה בדוח היומי ←
                </button>
              </CardContent>
            </Card>

            {/* Hero Card - State B: Attention Needed (commented for reference)
            <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 shadow-lg shadow-warning/5 rounded-2xl">
              <CardContent className="p-8 sm:p-10 text-center relative">
                <button 
                  onClick={() => navigate("/family")}
                  className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ניהול משפחה
                </button>
                
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-warning/15 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-warning" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  יש נושא אחד שכדאי לשים לב אליו*
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6">
                  קיפי הכין לך הסבר ברור ולא שיפוטי*
                </p>
                
                <button 
                  onClick={() => navigate(`/daily-report/${selectedChildId}`)}
                  className="text-sm text-warning hover:text-warning/80 font-medium transition-colors"
                >
                  לצפייה בדוח היומי ←
                </button>
              </CardContent>
            </Card>
            */}
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

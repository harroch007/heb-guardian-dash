import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { DemoBanner } from "@/components/DemoBanner";
import { Plus, Users, CheckCircle2, Eye, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEMO_CHILDREN } from "@/data/demoData";

const DemoDashboard = () => {
  const navigate = useNavigate();
  const [selectedChildId, setSelectedChildId] = useState<string>(DEMO_CHILDREN[0].id);

  const selectedChild = DEMO_CHILDREN.find(c => c.id === selectedChildId);

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

  return (
    <DashboardLayout>
      <DemoBanner />
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
        {/* Personalized Greeting */}
        <DashboardGreeting />

        <div className="space-y-6 animate-fade-in">
          {/* Child Selector - shown only when more than 1 child */}
          {DEMO_CHILDREN.length > 1 && selectedChild && (
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
                  {DEMO_CHILDREN.map((child) => (
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
                היום עבר בצורה תקינה
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6">
                קיפי לא זיהה מצבים שדורשים התערבות הורית
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DemoDashboard;

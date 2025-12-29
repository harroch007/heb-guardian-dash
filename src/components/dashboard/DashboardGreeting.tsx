import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";

export const DashboardGreeting = () => {
  const { user } = useAuth();
  const [parentName, setParentName] = useState<string | null>(null);

  useEffect(() => {
    const fetchParentName = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('parents')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      if (data?.full_name) {
        // Extract first name (before @ if email, or first word)
        const name = data.full_name.includes('@') 
          ? data.full_name.split('@')[0] 
          : data.full_name.split(' ')[0];
        setParentName(name);
      }
    };

    fetchParentName();
  }, [user?.id]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {getGreeting()}{parentName ? `, ${parentName}` : ''}! 👋
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        הנה סיכום מהיר של מה שקורה עם הילדים שלך היום
      </p>
    </div>
  );
};

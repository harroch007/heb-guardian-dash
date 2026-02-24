import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardGreetingProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const DashboardGreeting = ({ onRefresh, isRefreshing }: DashboardGreetingProps) => {
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
    <div className="flex items-center justify-between w-full">
      <h1 className="text-lg font-semibold text-foreground">
        {getGreeting()}{parentName ? `, ${parentName}` : ''} 👋
      </h1>
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
};

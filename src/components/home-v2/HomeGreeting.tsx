import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const HomeGreeting = () => {
  const { user } = useAuth();
  const [parentName, setParentName] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("parents")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (data?.full_name) {
        const name = data.full_name.includes("@")
          ? data.full_name.split("@")[0]
          : data.full_name.split(" ")[0];
        setParentName(name);
      }
    };
    fetch();
  }, [user?.id]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "בוקר טוב";
    if (hour < 17) return "צהריים טובים";
    if (hour < 21) return "ערב טוב";
    return "לילה טוב";
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">
        {getGreeting()}
        {parentName ? `, ${parentName}` : ""} 👋
      </h1>
    </div>
  );
};

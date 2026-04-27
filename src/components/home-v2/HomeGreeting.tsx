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
        .maybeSingle();

      // Prefer parents.full_name; fall back to auth user_metadata.full_name; then email local-part.
      const raw =
        data?.full_name ||
        (user.user_metadata as { full_name?: string } | undefined)?.full_name ||
        user.email?.split("@")[0] ||
        "";

      if (raw) {
        const name = raw.includes("@") ? raw.split("@")[0] : raw.split(" ")[0];
        setParentName(name);
      }
    };
    fetch();
  }, [user?.id, user?.email, user?.user_metadata]);

  const getGreeting = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const timeVal = h * 60 + m; // minutes since midnight
    if (timeVal < 330) return "לילה טוב";        // 00:00–05:29
    if (timeVal < 720) return "בוקר טוב";         // 05:30–11:59
    if (timeVal < 1020) return "צהריים טובים";     // 12:00–16:59
    if (timeVal < 1260) return "ערב טוב";          // 17:00–20:59
    return "לילה טוב";                             // 21:00–23:59
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">
        {getGreeting()}
        {parentName ? `, ${parentName}` : ""} 👋
      </h1>
    </div>
  );
};

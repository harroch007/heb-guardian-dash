import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const HomeGreeting = () => {
  const { user } = useAuth();
  const [parentName, setParentName] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;

      // Source priority:
      // 1. parents.full_name — but ONLY if it's not an email address (legacy bad data
      //    sometimes stored email as full_name, which would show e.g. "yariv" for a
      //    co-parent whose actual name is "אמא גאה").
      // 2. auth user_metadata.full_name (set by join-family-by-code on co-parent join).
      // 3. Email local-part as last resort.
      const { data } = await supabase
        .from("parents")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const metaName = (user.user_metadata as { full_name?: string } | undefined)
        ?.full_name;
      const emailLocal = user.email?.split("@")[0] || "";

      const dbName = data?.full_name?.trim() || "";
      const dbLooksLikeEmail = dbName.includes("@");

      const raw = !dbLooksLikeEmail && dbName ? dbName : metaName?.trim() || emailLocal;

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
    const timeVal = h * 60 + m;
    if (timeVal < 330) return "לילה טוב";
    if (timeVal < 720) return "בוקר טוב";
    if (timeVal < 1020) return "צהריים טובים";
    if (timeVal < 1260) return "ערב טוב";
    return "לילה טוב";
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

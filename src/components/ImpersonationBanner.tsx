import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    setIsImpersonating(sessionStorage.getItem("impersonating") === "true");
  }, []);

  if (!isImpersonating) return null;

  const handleExit = async () => {
    sessionStorage.removeItem("impersonating");
    await supabase.auth.signOut();
    window.close();
  };

  return (
    <div
      dir="rtl"
      className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium sticky top-0 z-[100]"
    >
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4" />
        <span>מצב התחזות — אתה צופה כהורה</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-black/30 bg-black/10 hover:bg-black/20 text-black"
        onClick={handleExit}
      >
        <X className="w-3 h-3 ml-1" />
        יציאה
      </Button>
    </div>
  );
}

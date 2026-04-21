import { Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import kippyLogo from "@/assets/kippy-logo.svg";

interface InstallAppCardProps {
  variant?: "settings" | "landing";
}

/**
 * כרטיס התקנת האפליקציה (PWA).
 * - Android/Chrome: כפתור התקנה ישיר.
 * - iOS: הוראות "שתף ← הוסף למסך הבית".
 * - מותקנת: לא מציג כלום.
 */
export function InstallAppCard({ variant = "settings" }: InstallAppCardProps) {
  const { isInstalled, isInstallable, install, isIOS } = usePWAInstall();

  if (isInstalled) return null;
  if (!isInstallable && !isIOS) return null;

  const Title = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">התקינו את Kippy כאפליקציה</h2>
        <p className="text-xs text-muted-foreground">גישה מהירה ממסך הבית, חוויית אפליקציה מלאה</p>
      </div>
    </div>
  );

  const Action = isInstallable ? (
    <Button onClick={install} className="gap-2 w-full sm:w-auto">
      <Download className="w-4 h-4" />
      התקנה
    </Button>
  ) : isIOS ? (
    <div className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
      <p className="font-medium text-foreground">להתקנה ב-iPhone:</p>
      <p className="flex items-center gap-1.5 flex-wrap">
        <span>1. לחצו על</span>
        <Share className="w-4 h-4 inline text-primary" />
        <span>"שתף" בסרגל הדפדפן.</span>
      </p>
      <p className="flex items-center gap-1.5 flex-wrap">
        <span>2. בחרו</span>
        <Plus className="w-4 h-4 inline text-primary" />
        <span>"הוסף למסך הבית".</span>
      </p>
    </div>
  ) : null;

  if (variant === "landing") {
    return (
      <section className="py-12" dir="rtl">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-5">
              <img src={kippyLogo} alt="Kippy" className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold text-foreground">התקינו את Kippy כאפליקציה</h2>
                <p className="text-sm text-muted-foreground">גישה מהירה ממסך הבית — בלי חנות אפליקציות</p>
              </div>
            </div>
            {Action}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
      {Title}
      {Action}
    </section>
  );
}

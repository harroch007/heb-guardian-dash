import { Download, Share, Plus, Smartphone, Chrome, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import kippyLogo from "@/assets/kippy-logo.svg";

interface InstallAppCardProps {
  variant?: "settings" | "landing";
}

/**
 * כרטיס התקנת האפליקציה (PWA).
 * - מותקנת: לא מציג כלום.
 * - settings: מציג רק כשיש אפשרות התקנה (Android Chrome / iOS).
 * - landing: מציג תמיד (חוץ מבמותקנת) — עם הוראות מותאמות לכל פלטפורמה.
 */
export function InstallAppCard({ variant = "settings" }: InstallAppCardProps) {
  const { isInstalled, isInstallable, install, isIOS, isAndroid } = usePWAInstall();

  if (isInstalled) return null;

  // ב-settings — שומרים על ההתנהגות הקיימת
  if (variant === "settings" && !isInstallable && !isIOS) return null;

  const isAndroidNonChrome = isAndroid && !isInstallable;
  const isDesktop = !isIOS && !isAndroid;

  const Action = isInstallable ? (
    <Button onClick={install} className="gap-2 w-full sm:w-auto">
      <Download className="w-4 h-4" />
      התקנה
    </Button>
  ) : isIOS ? (
    <div className="text-sm space-y-1.5 leading-relaxed">
      <p className="font-medium text-foreground">להתקנה ב-iPhone:</p>
      <p className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
        <span>1. לחצו על</span>
        <Share className="w-4 h-4 inline text-primary" />
        <span>"שתף" בסרגל הדפדפן.</span>
      </p>
      <p className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
        <span>2. בחרו</span>
        <Plus className="w-4 h-4 inline text-primary" />
        <span>"הוסף למסך הבית".</span>
      </p>
    </div>
  ) : isAndroidNonChrome ? (
    <div className="text-sm space-y-1.5 leading-relaxed">
      <p className="font-medium text-foreground">להתקנה ב-Android:</p>
      <p className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
        <span>1. פתחו את האתר ב-</span>
        <Chrome className="w-4 h-4 inline text-primary" />
        <span>Chrome.</span>
      </p>
      <p className="flex items-center gap-1.5 flex-wrap text-muted-foreground">
        <span>2. פתחו את התפריט</span>
        <MoreVertical className="w-4 h-4 inline text-primary" />
        <span>ובחרו "הוסף למסך הבית".</span>
      </p>
    </div>
  ) : isDesktop ? (
    <div className="text-sm space-y-1.5 leading-relaxed">
      <p className="font-medium text-foreground flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-primary" />
        רוצים להתקין כאפליקציה?
      </p>
      <p className="text-muted-foreground">
        פתחו את האתר בטלפון (Chrome ב-Android, או Safari ב-iPhone) ותקבלו אפשרות התקנה ישירה למסך הבית — ללא חנות אפליקציות.
      </p>
    </div>
  ) : null;

  if (variant === "landing") {
    return (
      <section className="py-12" dir="rtl">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto bg-card/60 backdrop-blur border border-primary/20 rounded-2xl p-6 sm:p-8 shadow-[0_0_24px_hsl(var(--primary)/0.15)]">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">התקינו את KippyAI כאפליקציה</h2>
                <p className="text-sm text-muted-foreground mt-1">גישה מהירה ממסך הבית — בלי חנות אפליקציות, עובד בכל טלפון</p>
              </div>
            </div>
            {Action}
          </div>
        </div>
      </section>
    );
  }

  // settings variant
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

  return (
    <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-3">
      {Title}
      {Action}
    </section>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Star, Shield, Zap, MapPin, Bell } from "lucide-react";
import kippyLogo from "@/assets/kippy-logo.png";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childName?: string;
}

const features = [
  { icon: MapPin, text: "מעקב מיקום בזמן אמת" },
  { icon: Bell, text: "התראות מיידיות על סיכונים" },
  { icon: Shield, text: "ניתוח AI מתקדם להודעות" },
  { icon: Zap, text: "דוחות שבועיים מפורטים" },
];

export function UpgradeModal({ open, onOpenChange, childName }: UpgradeModalProps) {
  const handleUpgrade = () => {
    // TODO: Implement actual upgrade flow
    window.open("https://kippy.app/upgrade", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-xl glow-primary flex items-center justify-center">
            <img src={kippyLogo} alt="Kippy" className="w-14 h-14 rounded-lg" />
          </div>
          <DialogTitle className="text-xl">
            שדרג ל-Kippy Premium
          </DialogTitle>
          <DialogDescription className="text-base">
            {childName ? `קבל הגנה מלאה על ${childName}` : "קבל הגנה מלאה על ילדיך"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <span>{feature.text}</span>
              <Check className="w-4 h-4 text-green-500 mr-auto" />
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-center mb-4">
          <div className="text-2xl font-bold text-foreground">₪29.90</div>
          <div className="text-sm text-muted-foreground">לחודש</div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleUpgrade} className="w-full gap-2">
            <Star className="w-4 h-4" />
            שדרג עכשיו
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            אולי אחר כך
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

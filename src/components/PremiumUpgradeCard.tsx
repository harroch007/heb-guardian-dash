import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Brain, Bell, BarChart3, Star } from "lucide-react";
import { UpgradeModal } from "@/components/UpgradeModal";

const premiumFeatures = [
  { icon: Brain, text: "ניתוח AI מתקדם לכל ההודעות" },
  { icon: Bell, text: "התראות חכמות בזמן אמת" },
  { icon: BarChart3, text: "תובנות יומיות וסיכומים" },
  { icon: Star, text: "זיהוי רגעים חיוביים" },
];

interface PremiumUpgradeCardProps {
  childName?: string;
}

export function PremiumUpgradeCard({ childName }: PremiumUpgradeCardProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">שדרג להגנה מלאה</h3>
              <p className="text-sm text-muted-foreground">
                {childName ? `הגן על ${childName} עם ניתוח AI` : "הגן על ילדיך עם ניתוח AI"}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {premiumFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <feature.icon className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">{feature.text}</span>
              </div>
            ))}
          </div>

          <Button onClick={() => setShowModal(true)} className="w-full gap-2 glow-primary">
            <Star className="h-4 w-4" />
            שדרג ל-Premium — ₪19/חודש
          </Button>
        </CardContent>
      </Card>

      <UpgradeModal open={showModal} onOpenChange={setShowModal} childName={childName} />
    </>
  );
}

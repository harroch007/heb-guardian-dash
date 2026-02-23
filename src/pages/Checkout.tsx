import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, Brain, Bell, BarChart3, Star, CreditCard, Loader2, Check, Tag, ArrowRight, MessageCircle, Lock } from "lucide-react";
import { toast } from "sonner";

const BASE_PRICE = 19;
const WHATSAPP_LINK = "https://wa.me/972547836498?text=היי%2C%20אשמח%20לקבל%20קוד%20קופון%20לשדרוג%20Premium";

const premiumFeatures = [
  { icon: Brain, text: "ניתוח AI מתקדם לכל ההודעות" },
  { icon: Bell, text: "התראות חכמות בזמן אמת" },
  { icon: BarChart3, text: "תובנות יומיות וסיכומים" },
  { icon: Star, text: "זיהוי רגעים חיוביים וקשרים פעילים" },
];

interface PromoResult {
  code: string;
  discount_type: string;
  discount_value: number;
  description: string;
}

function getPromoDescription(type: string, value: number): string {
  switch (type) {
    case "free_months":
      return value === 1 ? "חודש חינם!" : `${value} חודשים חינם!`;
    case "fixed_price":
      return `₪${value}/חודש לתמיד`;
    case "percent_off":
      return `${value}% הנחה`;
    default:
      return "";
  }
}

function getDiscountedPrice(type: string, value: number): number {
  switch (type) {
    case "free_months":
      return 0;
    case "fixed_price":
      return value;
    case "percent_off":
      return Math.round(BASE_PRICE * (1 - value / 100));
    default:
      return BASE_PRICE;
  }
}

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get("childId");

  const [showClosedDialog, setShowClosedDialog] = useState(false);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");

  const [paying, setPaying] = useState(false);

  const finalPrice = appliedPromo
    ? getDiscountedPrice(appliedPromo.discount_type, appliedPromo.discount_value)
    : BASE_PRICE;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");

    try {
      const { data, error } = await supabase
        .from("promo_codes" as any)
        .select("code, discount_type, discount_value, max_uses, current_uses, expires_at, is_active")
        .eq("code", promoCode.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setPromoError("קוד לא תקף");
        setAppliedPromo(null);
        return;
      }

      const promo = data as any;

      if (!promo.is_active) {
        setPromoError("קוד לא פעיל");
        setAppliedPromo(null);
        return;
      }

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        setPromoError("קוד פג תוקף");
        setAppliedPromo(null);
        return;
      }

      if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
        setPromoError("קוד מוצה לגמרי");
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        description: getPromoDescription(promo.discount_type, promo.discount_value),
      });
    } catch (err: any) {
      setPromoError("שגיאה באימות הקוד");
      console.error(err);
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePay = async () => {
    if (!childId) return;
    setPaying(true);

    try {
      let expiresAt: string | null = null;
      if (appliedPromo?.discount_type === 'free_months') {
        const d = new Date();
        d.setMonth(d.getMonth() + appliedPromo.discount_value);
        expiresAt = d.toISOString();
      }

      const { error: updateError } = await supabase
        .from("children")
        .update({ subscription_tier: "premium", subscription_expires_at: expiresAt } as any)
        .eq("id", childId);

      if (updateError) throw updateError;

      if (appliedPromo) {
        const { data: promoData } = await supabase
          .from("promo_codes" as any)
          .select("current_uses")
          .eq("code", appliedPromo.code)
          .single();
        const currentUses = (promoData as any)?.current_uses || 0;
        await supabase
          .from("promo_codes" as any)
          .update({ current_uses: currentUses + 1 } as any)
          .eq("code", appliedPromo.code);
      }

      toast.success("🎉 שדרגת ל-Premium בהצלחה!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("שגיאה בתהליך התשלום: " + err.message);
      console.error(err);
    } finally {
      setPaying(false);
    }
  };

  if (!childId) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto px-4 py-12 text-center" dir="rtl">
          <p className="text-muted-foreground">לא נמצא ילד לשדרוג</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="mt-4">
            חזרה לדשבורד
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">שדרג ל-Premium</h1>
          <p className="text-muted-foreground">הגנה מלאה עם ניתוח AI מתקדם</p>
        </div>

        {/* Features */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">מה כלול ב-Premium:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {premiumFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <span>{f.text}</span>
                <Check className="w-4 h-4 text-green-500 mr-auto" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Promo Code */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4" />
              קוד קופון
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="הכנס קוד..."
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setPromoError("");
                }}
                className="flex-1 font-mono tracking-wider"
                dir="ltr"
              />
              <Button
                variant="outline"
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoCode.trim()}
              >
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "החל"}
              </Button>
            </div>
            {promoError && <p className="text-sm text-destructive">{promoError}</p>}
            {appliedPromo && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">{appliedPromo.description}</span>
                <Badge variant="secondary" className="mr-auto text-xs">{appliedPromo.code}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price */}
        <Card className="border-primary/30">
          <CardContent className="pt-6 text-center">
            {appliedPromo ? (
              <div className="space-y-1">
                <div className="text-lg text-muted-foreground line-through">₪{BASE_PRICE}/חודש</div>
                <div className="text-3xl font-bold text-primary">
                  {finalPrice === 0 ? "חינם" : `₪${finalPrice}`}
                  {finalPrice > 0 && <span className="text-base font-normal text-muted-foreground">/חודש</span>}
                </div>
                <p className="text-sm text-green-600">{appliedPromo.description}</p>
              </div>
            ) : (
              <div>
                <div className="text-3xl font-bold">₪{BASE_PRICE}</div>
                <div className="text-sm text-muted-foreground">לחודש</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Buttons / Upgrade with Promo */}
        {appliedPromo ? (
          <Button
            onClick={handlePay}
            disabled={paying}
            className="w-full h-12 text-base gap-2"
          >
            {paying ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {paying ? "משדרג..." : finalPrice === 0 ? "שדרג עכשיו — חינם!" : `שדרג עכשיו — ₪${finalPrice}/חודש`}
          </Button>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">בחר אמצעי תשלום</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-16 justify-between text-base"
                onClick={() => setShowClosedDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <AppleIcon />
                  <span dir="ltr">Apple Pay</span>
                </div>
                <ArrowRight className="w-5 h-5 rotate-180" />
              </Button>

              <Button
                variant="outline"
                className="w-full h-16 justify-between text-base"
                onClick={() => setShowClosedDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <GoogleIcon />
                  <span dir="ltr">Google Pay</span>
                </div>
                <ArrowRight className="w-5 h-5 rotate-180" />
              </Button>

              <Button
                variant="outline"
                className="w-full h-16 justify-between text-base"
                onClick={() => setShowClosedDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6" />
                  <span>כרטיס אשראי</span>
                </div>
                <ArrowRight className="w-5 h-5 rotate-180" />
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">
          התשלום מאובטח. ניתן לבטל בכל עת.
        </p>
      </div>

      {/* System Closed Dialog */}
      <Dialog open={showClosedDialog} onOpenChange={setShowClosedDialog}>
        <DialogContent className="max-w-sm mx-4" dir="rtl">
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <DialogTitle className="text-lg">המערכת סגורה כרגע</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              כרגע לא ניתן להשלים תשלום. הגישה מוגבלת ללקוחות מוזמנים בלבד.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-center text-muted-foreground">
              לקבלת קוד קופון לשימוש, פנו אלינו בוואטסאפ:
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => window.open(WHATSAPP_LINK, "_blank")}
            >
              <MessageCircle className="w-5 h-5" />
              פנייה בוואטסאפ
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowClosedDialog(false)}
            >
              סגור
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

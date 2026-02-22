import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Brain, Bell, BarChart3, Star, CreditCard, Loader2, Check, Tag, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const BASE_PRICE = 19;

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

type CheckoutStep = "select" | "card";

const ApplePayLogo = () => (
  <svg viewBox="0 0 165 40" className="h-12" fill="currentColor">
    <path d="M150.7 0H14.3C6.4 0 0 6.4 0 14.3v11.4C0 33.6 6.4 40 14.3 40h136.4c7.9 0 14.3-6.4 14.3-14.3V14.3C165 6.4 158.6 0 150.7 0z" fill="hsl(var(--foreground))"/>
    <path d="M43.6 13.2c1.1-1.4 1.9-3.3 1.7-5.2-1.6.1-3.6 1.1-4.7 2.4-1 1.2-1.9 3.1-1.7 4.9 1.8.2 3.6-.9 4.7-2.1zm1.6 2.6c-2.6-.2-4.8 1.5-6 1.5s-3.1-1.4-5.2-1.4c-2.7 0-5.1 1.5-6.5 3.9-2.8 4.8-.7 11.9 2 15.8 1.3 1.9 2.9 4.1 5 4 2-.1 2.8-1.3 5.2-1.3s3.1 1.3 5.2 1.2c2.2 0 3.5-1.9 4.8-3.9 1.5-2.2 2.1-4.3 2.1-4.4 0-.1-4.1-1.6-4.1-6.1 0-3.8 3.1-5.6 3.2-5.7-1.7-2.6-4.4-2.9-5.4-3-.3-.3-.2-.5-.3-.6z" fill="hsl(var(--background))"/>
    <path d="M78.4 10.1c5.1 0 8.7 3.5 8.7 8.7s-3.6 8.7-8.8 8.7h-5.7v9h-4.2V10.1h10zm-5.8 14h4.7c3.6 0 5.6-1.9 5.6-5.3s-2-5.3-5.5-5.3h-4.8v10.6zm18.4 6.7c0-3.4 2.6-5.5 7.2-5.8l5.3-.3v-1.5c0-2.2-1.5-3.4-3.9-3.4-2.3 0-3.8 1.2-4.1 3h-3.9c.2-3.7 3.3-6.5 8.2-6.5 4.8 0 7.8 2.6 7.8 6.6v13.6h-3.9v-3.3h-.1c-1.1 2.2-3.6 3.6-6.2 3.6-3.9 0-6.4-2.4-6.4-5.9zm12.5-1.8v-1.5l-4.8.3c-2.4.2-3.7 1.1-3.7 2.9 0 1.8 1.4 2.9 3.6 2.9 2.8 0 4.9-1.9 4.9-4.6zm9.4 10.8v-3.3c.3.1 1 .1 1.3.1 1.8 0 2.8-.8 3.4-2.7l.4-1.1-7.6-21h4.4l5.5 17.2h.1l5.5-17.2h4.3l-7.9 22c-1.8 5.1-3.9 6.7-8.2 6.7-.4 0-1.1 0-1.2-.1v.4z" fill="hsl(var(--background))"/>
  </svg>
);

const GooglePayLogo = () => (
  <svg viewBox="0 0 150 40" className="h-12">
    <rect width="150" height="40" rx="14" fill="hsl(var(--foreground))"/>
    <text x="75" y="26" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="bold" fill="hsl(var(--background))">
      Google Pay
    </text>
  </svg>
);

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get("childId");

  const [step, setStep] = useState<CheckoutStep>("select");

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardId, setCardId] = useState("");
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

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const isFormValid =
    cardNumber.replace(/\D/g, "").length === 16 &&
    cardExpiry.replace(/\D/g, "").length === 4 &&
    cardCvv.length === 3 &&
    cardName.trim().length >= 2 &&
    cardId.replace(/\D/g, "").length === 9;

  const handlePay = async () => {
    if (!childId) return;
    setPaying(true);

    try {
      const { error: updateError } = await supabase
        .from("children")
        .update({ subscription_tier: "premium" })
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

        {/* Payment Method Selection */}
        {step === "select" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">בחר אמצעי תשלום</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-16 justify-between text-base"
                onClick={handlePay}
                disabled={paying}
              >
                <div className="flex items-center gap-3">
                  <ApplePayLogo />
                </div>
                {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 rotate-180" />}
              </Button>

              <Button
                variant="outline"
                className="w-full h-16 justify-between text-base"
                onClick={handlePay}
                disabled={paying}
              >
                <div className="flex items-center gap-3">
                  <GooglePayLogo />
                </div>
                {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 rotate-180" />}
              </Button>

              <Button
                variant="outline"
                className="w-full h-16 justify-between text-base"
                onClick={() => setStep("card")}
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

        {/* Credit Card Form */}
        {step === "card" && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    פרטי תשלום
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
                    חזרה
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>שם בעל הכרטיס</Label>
                  <Input
                    placeholder="ישראל ישראלי"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ת.ז בעל הכרטיס</Label>
                  <Input
                    placeholder="012345678"
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    maxLength={9}
                    dir="ltr"
                    className="font-mono tracking-wider"
                  />
                </div>
                <div className="space-y-2">
                  <Label>מספר כרטיס</Label>
                  <Input
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    dir="ltr"
                    className="font-mono tracking-wider"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>תוקף</Label>
                    <Input
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      dir="ltr"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV</Label>
                    <Input
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      maxLength={3}
                      dir="ltr"
                      className="font-mono"
                      type="password"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handlePay}
              disabled={!isFormValid || paying}
              className="w-full h-12 text-base gap-2"
            >
              {paying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              {paying ? "מעבד תשלום..." : finalPrice === 0 ? "שדרג עכשיו — חינם!" : `שלם ושדרג — ₪${finalPrice}/חודש`}
            </Button>
          </>
        )}

        <p className="text-xs text-center text-muted-foreground">
          התשלום מאובטח. ניתן לבטל בכל עת.
        </p>
      </div>
    </DashboardLayout>
  );
}

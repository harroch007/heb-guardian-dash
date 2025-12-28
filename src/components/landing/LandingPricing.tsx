import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";

const plans = [
  {
    name: "Basic",
    subtitle: "תמונת מצב מלאה",
    price: "חינם",
    features: [
      "ילד אחד",
      "מיקום הילד בזמן אמת",
      "מצב בטריה",
      "זמן מסך יומי",
      "הגבלת זמן מסך",
      "סטטוס מכשיר (מחובר/מנותק)",
    ],
    cta: "התחילו חינם",
    highlighted: false,
    pricingTable: null,
  },
  {
    name: "Premium",
    subtitle: "הגנה מלאה ושקט נפשי",
    price: " ₪29",
    period: "/חודש",
    features: [
      "כל מה שב-Basic",
      "ניתוח AI 24/7 על כל התקשורות",
      "WhatsApp, Telegram, Discord, TikTok, Instagram ועוד",
      "התראות חכמות בזמן אמת",
      "דוח שבועי מפורט",
      "תמיכה VIP",
    ],
    cta: "בחרו Premium",
    highlighted: true,
    pricingTable: [
      { children: "ילד אחד", price: "₪29/חודש" },
      { children: "2 ילדים", price: "₪45/חודש" },
      { children: "3 ילדים", price: "₪60/חודש" },
    ],
  },
  {
    name: "משפחות גדולות",
    subtitle: "4 ילדים ומעלה",
    price: "צרו קשר",
    features: ["כל מה שב-Premium", "מחיר מותאם אישית", "תמיכה VIP"],
    cta: "דברו איתנו",
    highlighted: false,
    pricingTable: null,
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">תמחור שקוף ופשוט</h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
          בחרו את התכנית המתאימה למשפחה שלכם - ללא התחייבות, ניתן לשנות בכל עת
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card border rounded-2xl p-8 ${
                plan.highlighted ? "border-primary shadow-lg shadow-primary/20" : "border-border"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    המומלץ ביותר
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground mb-4">{plan.subtitle}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-primary">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-4 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-success flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.pricingTable && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  {plan.pricingTable.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center py-2 border-b border-border last:border-0"
                    >
                      <span className="text-muted-foreground">{row.children}</span>
                      <span className="font-medium text-foreground">{row.price}</span>
                    </div>
                  ))}
                </div>
              )}

              <Link to="/auth?signup=true" className="block">
                <Button
                  className={`w-full ${plan.highlighted ? "glow-primary" : ""}`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground mt-8">
          כל התכניות כוללות ניסיון חינם ל-14 יום · ללא צורך בכרטיס אשראי · ניתן לבטל בכל עת
        </p>
      </div>
    </section>
  );
}

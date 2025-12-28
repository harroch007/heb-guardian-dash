import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Star } from 'lucide-react';

const plans = [
  {
    name: "Basic",
    subtitle: "מושלם להתחלה",
    price: "חינם",
    features: [
      "עד ילד 1",
      "התרעות בסיסיות",
      "זיהוי סכנות מרכזיות",
      "תמיכה קהילתית",
      "דוח שבועי בסיסי"
    ],
    cta: "התחילו חינם",
    highlighted: false
  },
  {
    name: "Pro",
    subtitle: "המומלץ למשפחות",
    price: "₪29",
    period: "/חודש",
    features: [
      "עד 3 ילדים",
      "התרעות מתקדמות + הקשר",
      "ניתוח AI מלא",
      "דוחות שבועיים מפורטים",
      "תמיכה מועדפת",
      "היסטוריה של 6 חודשים"
    ],
    cta: "בחרו Pro",
    highlighted: true
  },
  {
    name: "Enterprise",
    subtitle: "למשפחות גדולות",
    price: "₪99",
    period: "/חודש",
    features: [
      "מספר ילדים ללא הגבלה",
      "כל התכונות של Pro",
      "תמיכה VIP 24/7",
      "ניתוח מותאם אישית",
      "ייעוץ משפחתי חודשי",
      "היסטוריה ללא הגבלה"
    ],
    cta: "פנו אלינו",
    highlighted: false
  }
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          תמחור שקוף ופשוט
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
          בחרו את התכנית המתאימה למשפחה שלכם - ללא התחייבות, ניתן לשנות בכל עת
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative bg-card border rounded-2xl p-8 ${
                plan.highlighted 
                  ? 'border-primary shadow-lg shadow-primary/20' 
                  : 'border-border'
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

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-success flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to="/auth" className="block">
                <Button 
                  className={`w-full ${plan.highlighted ? 'glow-primary' : ''}`}
                  variant={plan.highlighted ? 'default' : 'outline'}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground mt-8">
          כל התכניות כוללות ניסיון חינם ל-14 יום • ללא צורך בכרטיס אשראי • ניתן לבטל בכל עת
        </p>
      </div>
    </section>
  );
}

import { Brain, Lock, BellRing } from 'lucide-react';

const differentiators = [
  {
    icon: Brain,
    title: "בינה מלאכותית הקשרית",
    subtitle: "לא רק מילים, אלא הקשר שלם",
    description: "Kippy לא מחפשת רק מילות מפתח. היא מנתחת את ההקשר, את הטון, את הדפוסים - כמו הורה שקורא בין השורות ומבין מתי באמת צריך להתריע."
  },
  {
    icon: Lock,
    title: "הגנה ללא פגיעה בפרטיות",
    subtitle: "ילד מוגן = הורה שקט",
    description: "95% מהניתוח מתבצע על המכשיר עצמו. התוכן לא עוזב את הטלפון של הילד - אנחנו מקבלים רק התראות על סכנות אמיתיות. הילד שומר על פרטיות, אתם שומרים על ילד."
  },
  {
    icon: BellRing,
    title: "התרעות חכמות, לא רעש",
    subtitle: "רק מה שחשוב באמת",
    description: "המערכת לומדת ומשתפרת עם הזמן. פחות אזעקות שווא, יותר שקט נפשי, התערבות מדויקת בדיוק כשצריך."
  }
];

export function LandingDifferentiators() {
  return (
    <section className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          מה עושה אותנו <span className="text-primary text-glow">שונים</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {differentiators.map((item, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-8 hover:border-primary/50 transition-all duration-300"
            >
              <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mb-6">
                <item.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">{item.title}</h3>
              <p className="text-primary font-medium mb-4">{item.subtitle}</p>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

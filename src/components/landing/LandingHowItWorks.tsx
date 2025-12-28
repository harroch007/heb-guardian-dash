import { Download, Brain, Bell, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    number: "01",
    icon: Download,
    title: "מוסיפים שכבת הגנה",
    description: "מתקינים את האפליקציה בטלפון של הילד, היא מגינה עליו 24/7 ומעדכנת אתכם רק כשיש באמת צורך בהתערבות הורית. אין לנו גישה לתוכן ההודעות. ניתן לנתק בכל רגע.",
    bullets: [
      "התקנה פשוטה ומהירה",
      "פועלת ברקע בלי להפריע",
      "התרעות רק כשצריך"
    ]
  },
  {
    number: "02",
    icon: Brain,
    title: "זיהוי הקשרי חכם",
    description: "ה-AI של Kippy מבין את התמונה סביב השיחה – מי פונה, באיזו תדירות, איך הטון משתנה ומה נרמז בין השורות. כך אנו מזהים מצבים כמו לחץ חברתי, הדרה, התחזות, סחיטה או קישורים מסוכנים – ומעדכנים אתכם רק כשזה באמת חשוב.",
    bullets: [
      "ניתוח שיחה ולא רק מילים",
      "למידה והתאמה לילד",
      "לא שומרים תוכן, רק התרעות ממוקדות"
    ]
  },
  {
    number: "03",
    icon: Bell,
    title: "התרעות ממוקדות להורים",
    description: "מקבלים התרעה רק כשדרושה התערבות הורית – עם הסבר קצר והנחיית פעולה. פחות רעש, יותר שקט נפשי.",
    bullets: [
      "התרעות רק כשצריך",
      "ניסוח ברור בעברית",
      "המלצה לפעולה"
    ]
  }
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          איך זה <span className="text-primary text-glow">עובד?</span>
        </h2>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden"
            >
              <div className="absolute top-4 left-4 text-8xl font-bold text-primary/10">
                {step.number}
              </div>
              <div className="relative z-10 flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-4 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground mb-6">{step.description}</p>
                  <ul className="space-y-2">
                    {step.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

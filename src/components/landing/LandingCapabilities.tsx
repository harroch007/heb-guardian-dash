import { Users, UserX, AlertTriangle, BarChart3 } from 'lucide-react';

const capabilities = [
  {
    icon: Users,
    title: "זיהוי מוקדם של בריונות וחרם",
    description: "מזהה שינויים בדפוסי תקשורת, הדרה מקבוצות, ושיחות פוגעות - לפני שהמצב מחמיר ונגרם נזק רגשי לילד."
  },
  {
    icon: UserX,
    title: "הגנה מפני זרים מסוכנים",
    description: "מתריעה כשמישהו לא מוכר יוצר קשר עם הילד, מנסה לתזמן פגישה, מבקש מידע אישי או מציג התנהגות חשודה."
  },
  {
    icon: AlertTriangle,
    title: "זיהוי תוכן לא הולם",
    description: "מזהה תוכן מיני, אלים, סמים או כל תוכן לא מתאים לגיל - ומתריעה בזמן לפני חשיפה ממושכת שעלולה לפגוע."
  },
  {
    icon: BarChart3,
    title: "דוחות ותובנות הוריות",
    description: "סיכום שבועי של פעילות, טרנדים בהתנהגות הילד ברשת, וכלים להתמודדות חינוכית - לא רק התרעות, גם הבנה."
  }
];

export function LandingCapabilities() {
  return (
    <section className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          היכולות המרכזיות
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
          ארבעת עמודי התווך של Kippy - כדי שתדעו בדיוק איך אנחנו שומרים על הילדים שלכם
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {capabilities.map((capability, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-8 hover:border-primary/50 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <capability.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">{capability.title}</h3>
                  <p className="text-muted-foreground">{capability.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

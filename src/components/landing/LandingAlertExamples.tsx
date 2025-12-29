import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bell } from 'lucide-react';

const alerts = [
  {
    title: "זר מסוכן",
    content: "דניאל קיבל וואטסאפ ממספר לא מוכר: 'היי דניאל, שמעתי עליך, אשמח שניפגש.' נשלחה ב־11:40 ממספר 051-2345678. עד כה לא התקבלה תגובה. שווה לדבר עם הילד על שיחה עם זרים."
  },
  {
    title: "בריונות",
    content: "נועה קיבלה הודעה בקבוצת הוואטסאפ 'כיתה ח2': 'את לא שווה כלום.' נשלחה ב־20:15. מומלץ לבדוק עם הילדה איך היא מרגישה."
  },
  {
    title: "חרם",
    content: "אדם הוסר מקבוצת 'החברים של שבת'. זה קרה ב־17:05. ייתכן שמדובר בחרם – שווה לשאול מה קרה."
  }
];

export function LandingAlertExamples() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-4">
          ככה נראות ההתרעות מ-<span className="text-primary text-glow">KippyAI</span>
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto lg:text-lg">
          התרעות חכמות שמגיעות אליכם בזמן אמת כשהילדים שלכם זקוקים לעזרה
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-6 hover:border-warning/50 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">התרעת KippyAI</p>
                  <p className="text-xs text-muted-foreground">עכשיו</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                {alert.content}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">צפה בפרטים</Button>
                <Button variant="ghost" size="sm" className="flex-1">סמן כנקרא</Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/auth">
            <Button size="lg" className="glow-primary">הצטרפו עכשיו</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

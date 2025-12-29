import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, MessageCircleOff, ShieldOff, CheckCircle2 } from 'lucide-react';

const problems = [
  {
    icon: Eye,
    title: "הסכנות הנסתרות",
    problem: "הילד שלכם עשוי להיחשף לבריונות, חרם חברתי, שיחות אלימות, או פנייה מזרים - וההורים לא יודעים עד שזה מאוחר מדי.",
    solution: "Kippy מזהה בזמן אמת מצבים מסוכנים ושולחת התרעה רק כשנדרשת התערבות הורית."
  },
  {
    icon: MessageCircleOff,
    title: "הילד לא מספר הכל",
    problem: "גם הילדים הכי פתוחים לא מספרים הכל להורים - לפעמים מבושה, לפעמים מפחד, לפעמים כי הם לא מזהים את הסכנה.",
    solution: "Kippy עוקבת אחרי הקשר השיחה, לא רק מילים בודדות, ומעדכנת בזמן לפני שהמצב מחמיר."
  },
  {
    icon: ShieldOff,
    title: "פתרונות קיימים פוגעים באמון",
    problem: "אפליקציות מעקב מסורתיות חוסמות, מגבילות ופוגעות בפרטיות - דבר שהורס את האמון בין הורה לילד.",
    solution: "Kippy לא חוסמת, לא מגבילה - היא מגינה ברקע ומתריעה רק כשצריך. הילד שומר על חופש ופרטיות."
  }
];

export function LandingProblemSolution() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-4">
          הבעיה והפתרון
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto lg:text-lg">
          שלושה אתגרים מרכזיים שהורים מתמודדים איתם היום
        </p>

        <div className="space-y-8">
          {problems.map((item, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-all"
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-destructive/20 rounded-xl flex items-center justify-center">
                    <item.icon className="w-7 h-7 text-destructive" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl lg:text-2xl font-bold mb-3 text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground mb-4 lg:text-lg">{item.problem}</p>
                  <div className="flex items-start gap-3 bg-success/10 border border-success/30 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-success mb-1">פתרון:</p>
                      <p className="text-muted-foreground">{item.solution}</p>
                    </div>
                  </div>
                </div>
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

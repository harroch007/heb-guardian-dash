import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle2, PiggyBank } from 'lucide-react';

const steps = [
  { icon: ClipboardList, title: 'אתם נותנים משימות', desc: 'סדר חדר, שיעורים, עזרה בבית — מה שמתאים לכם' },
  { icon: CheckCircle2, title: 'הילד מבצע ומסמן', desc: 'אפילו עם תמונת הוכחה — שקוף ואמין' },
  { icon: PiggyBank, title: 'דקות נכנסות לבנק', desc: 'אתם מאשרים, והזמן נצבר ככסף בחשבון' },
];

export function CoachSpotlight() {
  return (
    <section className="py-16 md:py-24 bg-white" dir="rtl">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent rounded-3xl blur-2xl" />
          <div className="relative bg-gradient-to-br from-primary/5 via-white to-primary/10 border border-primary/20 rounded-3xl p-8 md:p-12 shadow-xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-bold mb-4">
                ⭐ Kippy Coach
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                הילד <span className="text-primary">מרוויח</span> זמן מסך —
                <br />
                לא מקבל אותו במתנה
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                הכלי הייחודי שמחנך לניהול זמן בריא, דרך משימות יומיומיות
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mb-8">
              {steps.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="bg-white rounded-2xl p-6 border border-border text-center relative">
                  <div className="absolute -top-3 right-4 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-base md:text-lg font-semibold text-foreground italic">
                "כמו חינוך פיננסי — אבל לזמן מסך"
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

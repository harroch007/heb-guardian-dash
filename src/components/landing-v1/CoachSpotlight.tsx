import { motion } from 'framer-motion';
import {
  Activity,
  Bell,
  BrainCircuit,
  MessageCircle,
  Mic,
  ShieldCheck,
} from 'lucide-react';

const protectionAreas = [
  { icon: MessageCircle, text: 'ניתוח הודעות טקסט ב־WhatsApp' },
  { icon: Mic, text: 'תמלול הודעות קוליות ברצף הנכון' },
  { icon: BrainCircuit, text: 'הבנת הקשר ותפקיד הילד בשיחה' },
  { icon: Bell, text: 'התראה להורה רק לאחר אימות' },
  { icon: Activity, text: 'מצב ניטור והרשאות המכשיר' },
];

export function CoachSpotlight() {
  return (
    <section className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="relative max-w-6xl mx-auto"
        >
          <div className="relative bg-card border border-primary/30 rounded-3xl p-5 sm:p-8 md:p-12 shadow-xl">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                  לכל ילד יש
                  <br />
                  <span className="text-primary">הגנה נפרדת משלו</span>
                </h2>
                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                  כל שיחה נשמרת במחסנית נפרדת, נבדקת בהקשר ומוצגת להורה רק כשנדרשת תשומת לב.
                </p>

                <div className="space-y-3">
                  {protectionAreas.map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3 text-sm text-foreground"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-5 shadow-lg">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </span>
                    <div>
                      <p className="font-bold text-foreground">הניטור של נועם</p>
                      <p className="text-xs text-muted-foreground">המכשיר מחובר והניטור פעיל</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-success/15 px-2 py-1 text-[10px] font-semibold text-success">
                    פעיל
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {protectionAreas.slice(0, 4).map(({ icon: Icon, text }) => (
                    <div key={text} className="rounded-xl border border-border p-3">
                      <Icon className="mb-2 h-4 w-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

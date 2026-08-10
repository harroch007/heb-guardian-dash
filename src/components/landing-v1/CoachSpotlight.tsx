import { motion } from 'framer-motion';
import {
  Activity,
  Bell,
  BrainCircuit,
  MessageCircle,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';

const protectionAreas = [
  { icon: SlidersHorizontal, text: 'גבולות ברורים לשימוש בטלפון' },
  { icon: BrainCircuit, text: 'הבנת הקשר במקום תגובה למילה בודדת' },
  { icon: Bell, text: 'סימנים ממוקדים שכדאי לבדוק' },
  { icon: MessageCircle, text: 'הכוונה לשיחה רגועה עם הילד' },
  { icon: Activity, text: 'שקיפות לגבי מצב המוצר והתקדמותו' },
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
                  מה אנחנו בונים
                  <br />
                  <span className="text-primary">לקראת ההשקה</span>
                </h2>
                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                  KippyAI נמצאת בפיתוח. אלה עקרונות היעד של המוצר, לא תיאור של יכולות שזמינות כעת.
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
                      <p className="font-bold text-foreground">כיוון המוצר</p>
                      <p className="text-xs text-muted-foreground">תצוגת עקרונות לקראת ההשקה</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-success/15 px-2 py-1 text-[10px] font-semibold text-success">
                    בפיתוח
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

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: 'מה הסטטוס של KippyAI כיום?',
    a: 'KippyAI נמצאת בפיתוח לקראת השקה. הצטרפות לעדכונים אינה פתיחת חשבון ואינה מעידה שהמוצר זמין לציבור.',
  },
  {
    q: 'האם יכולות WhatsApp והודעות קוליות זמינות?',
    a: 'לא. יכולות אלה אינן מוצגות כזמינות בשלב ה־pre-launch. נעדכן רק לאחר השלמת שערי המוצר והבדיקות המתאימות.',
  },
  {
    q: 'מה מקבלים אחרי שמצטרפים לעדכונים?',
    a: 'עדכונים על התקדמות KippyAI והזדמנויות עתידיות להשתתף בפיילוט. ההצטרפות אינה מבטיחה הזמנה או מועד פתיחה.',
  },
  {
    q: 'איך תטפלו במידע כשהמוצר ייפתח?',
    a: 'לפני פתיחת הגישה נפרסם הסבר שתואם לזרימת המידע בפועל: מה מעובד, מה ההורה רואה, מה נשמר ומה ניתן למחוק.',
  },
];

export function FAQAccordion() {
  return (
    <section className="py-16 md:py-20" dir="rtl">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">שאלות נפוצות</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`item-${i}`}
              className="bg-card border border-border rounded-2xl px-5 border-b"
            >
              <AccordionTrigger className="text-right hover:no-underline">
                <span className="flex items-center gap-3 text-base font-semibold text-foreground">
                  <HelpCircle className="w-5 h-5 text-primary shrink-0" />
                  {f.q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pr-8">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

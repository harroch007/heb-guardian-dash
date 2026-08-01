import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: 'האם Kippy קוראת כל הודעה בשרת?',
    a: 'לא. שתי שכבות הסינון הראשונות והמחסניות פועלות במכשיר הילד. רק כשעולה חשד מוצדק, נשלח ההקשר הדרוש לבדיקה מתקדמת ומוגנת.',
  },
  {
    q: 'איך Kippy מצמצמת התראות שווא?',
    a: 'המערכת אינה מסתפקת במילת טריגר. היא בוחנת את רצף השיחה, הכיוון, המשתתפים והגיל כדי להבדיל בין צחוק וסלנג לבין פגיעה אמיתית.',
  },
  {
    q: 'מה הילד רואה באפליקציה?',
    a: 'האפליקציה פועלת בשקיפות ומציגה רק שמערכת ההגנה פעילה. הילד אינו רואה תוכן מנוטר, התראות להורה או נתוני ניתוח.',
  },
  {
    q: 'מה קורה אם האפליקציה מוסרת או הרשאה מתבטלת?',
    a: 'ממשק ההורה מציג שהניטור הופסק ושמכשיר הילד אינו מוגן כרגע, כדי שאפשר יהיה לטפל בכך מיד.',
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

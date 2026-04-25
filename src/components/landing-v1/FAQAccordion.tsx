import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: 'האם הילד יכול לבקש עוד זמן?',
    a: 'כן. הילד יכול לשלוח בקשה לזמן נוסף דרך האפליקציה, וההורה מקבל התראה ויכול לאשר או לדחות בלחיצה אחת — בלי ויכוחים.',
  },
  {
    q: 'איך עובדת מערכת המשימות והדקות?',
    a: 'ההורה מגדיר משימות (סידור חדר, קריאה, עזרה בבית) וכמה דקות מסך כל משימה שווה. הילד מסמן ביצוע, ההורה מאשר, והדקות נכנסות לבנק האישי שלו.',
  },
  {
    q: 'האם אפשר להגדיר חוקים שונים לכל ילד?',
    a: 'בהחלט. כל ילד מקבל פרופיל נפרד עם הגדרות זמן מסך, חסימות אפליקציות, לוחות זמנים ומשימות — בהתאמה אישית מלאה.',
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

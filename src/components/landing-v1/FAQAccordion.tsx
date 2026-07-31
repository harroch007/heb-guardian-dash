import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: 'האם הילד/ה יכול/ה לבקש עוד זמן?',
    a: 'כן. הילד/ה יכול/ה לשלוח בקשה לזמן נוסף דרך האפליקציה, וההורה מקבל התראה ויכול לאשר או לדחות בלחיצה אחת — בלי ויכוחים.',
  },
  {
    q: 'מה ההורה יכול לנהל במרכז ההגנה?',
    a: 'לכל ילד יש מרכז הגנה נפרד ובו זמן מסך, אפליקציות, לוחות זמנים, מיקום, אזורים בטוחים, צלצול, מצב אבוד ותקינות המכשיר.',
  },
  {
    q: 'האם אפשר להגדיר חוקים שונים לכל ילד?',
    a: 'בהחלט. כל ילד מקבל פרופיל נפרד עם הגדרות זמן מסך, אפליקציות, לוחות זמנים ומיקום — בהתאמה אישית מלאה.',
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

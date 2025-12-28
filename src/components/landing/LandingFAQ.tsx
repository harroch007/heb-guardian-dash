import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "האם KippyAI קוראת את כל ההודעות של הילד?",
    answer: "לא. Kippy מנתחת מטא-דאטה ודפוסי תקשורת, לא את תוכן ההודעות עצמן. אנחנו לא שומרים ולא קוראים הודעות - רק מזהים דפוסים חשודים ומתריעים בהתאם."
  },
  {
    question: "מה לגבי פרטיות?",
    answer: "פרטיות היא ערך עליון אצלנו. אנחנו לא שומרים תוכן שיחות, רק מטא-דאטה של התרעות. כל המידע מוצפן, והילד יודע שהאפליקציה מותקנת - זה לא ריגול, זו הגנה."
  },
  {
    question: "האם אקבל הרבה התרעות? לא רוצה \"רעש\".",
    answer: "לא. המערכת שלנו מבוססת על AI שלומד ומשתפר עם הזמן. אתם תקבלו התרעות רק כשיש באמת צורך בהתערבות הורית - פחות אזעקות שווא, יותר שקט נפשי."
  },
  {
    question: "האם אפשר לחבר כמה ילדים/מכשירים?",
    answer: "בהחלט! בתוכנית Basic ניתן לחבר ילד אחד, בתוכנית Pro עד 3 ילדים, ובתוכנית Enterprise - ללא הגבלה."
  },
  {
    question: "מה קורה אם המכשיר כבוי או בלי אינטרנט?",
    answer: "כשהמכשיר חוזר לפעילות, Kippy מתעדכנת אוטומטית ומנתחת את מה שקרה. אתם תקבלו התרעות רלוונטיות גם אם הייתה הפסקה זמנית."
  },
  {
    question: "איך מבטלים ומוחקים נתונים?",
    answer: "ניתן לבטל את המנוי ולמחוק את כל הנתונים בכל עת דרך ההגדרות. המחיקה היא מלאה ובלתי הפיכה - אנחנו לא שומרים שום דבר אחרי המחיקה."
  },
  {
    question: "כמה זה עולה? והאם צריך כרטיס אשראי לניסיון?",
    answer: "יש תוכנית חינמית לילד אחד. תוכנית Pro עולה ₪29 לחודש ו-Enterprise ₪99 לחודש. לניסיון החינמי אין צורך בכרטיס אשראי."
  }
];

export function LandingFAQ() {
  return (
    <section id="faq" className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          הורים שואלים – <span className="text-primary text-glow">אנחנו עונים</span>
        </h2>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-primary/50"
              >
                <AccordionTrigger className="text-right hover:no-underline py-6">
                  <span className="text-lg font-medium text-foreground">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

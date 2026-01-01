import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "האם KippyAI קוראת את כל ההודעות של הילד?",
    answer: `כן, אבל עם הבדל קריטי - 95% מהניתוח קורה ישירות על הטלפון של הילד.
ההודעות לא נשלחות לשרתים שלנו.
רק כשהמערכת מזהה משהו מדאיג, נשלחת התראה אנונימית אליכם.
אנחנו לא שומרים את תוכן ההודעות - רק מגנים על הילד.`,
  },
  {
    question: "על אילו אפליקציות KippyAI עובדת?",
    answer: `על כולן.
WhatsApp, TikTok, Instagram, Discord, Telegram, Roblox, Snapchat ועוד.
בכל מקום שהילד מתכתב - אנחנו שם כדי להגן עליו.`,
  },
  {
    question: "האם הילד יודע שהאפליקציה מותקנת?",
    answer: `כן, וזה בכוונה.
אנחנו לא אפליקציית ריגול.
יש התראה קבועה על המכשיר שמראה שהאפליקציה פעילה.
אנחנו מאמינים בשקיפות - זו הגנה, לא מעקב סמוי.
הורים רבים מגלים שעצם הידיעה שיש פיקוח משפרת את ההתנהגות.`,
  },
  {
    question: "מה עם התראות שווא? לא רוצה להיבהל על כל דבר.",
    answer: `זו בדיוק הסיבה שבנינו את המערכת עם בינה מלאכותית מתקדמת.
היא מבינה הקשר - "אני הולך להרוג אותך" במשחק זה לא אותו דבר כמו איום אמיתי.
אתם תקבלו התראות רק כשבאמת צריך לשים לב.
פחות רעש, יותר שקט נפשי.`,
  },
  {
    question: "כמה ילדים אפשר לחבר?",
    answer: `אין הגבלה!
בחבילה החינמית - כמה ילדים שתרצו עם בקרת הורים בסיסית.
בחבילת Premium - מחיר משתנה לפי מספר הילדים: ילד אחד ב-19₪, שניים ב-30₪, שלושה ב-40₪.
משפחה גדולה יותר? נתאים לכם הצעה מיוחדת.`,
  },
  {
    question: "מה קורה אם לילד נגמרת הסוללה או אין אינטרנט?",
    answer: `ברגע שהמכשיר חוזר לפעול, KippyAI ממשיכה מאיפה שהפסיקה.
ההודעות שהתקבלו בזמן שהמכשיר היה כבוי ינותחו ותקבלו התראות אם יש צורך.
אין "חור" בהגנה.`,
  },
  {
    question: "כמה זה עולה?",
    answer: `יש חבילה חינמית לכל ילד - מיקום בזמן אמת, מצב סוללה, זמן מסך יומי והגבלת זמן מסך.
בלי ניתוח תוכן, אבל מעולה לבקרת הורים בסיסית.
חבילת Premium ב-19₪ לחודש נותנת שקט נפשי אמיתי - כל מה שבחינם + הגנה מלאה 24/7 עם ניתוח AI + שירות לקוחות VIP.
שני ילדים ב-30₪, שלושה ב-40₪.
יותר משלושה? פנו אלינו ונתאים לכם הצעה מיוחדת למשפחה.`,
  },
  {
    question: "מה עם הפרטיות שלנו ושל הילד?",
    answer: `פרטיות זה לא רק סיסמה אצלנו - זה הארכיטקטורה של המוצר.
95% מהעיבוד קורה על המכשיר עצמו.
אנחנו לא שומרים את ההודעות בשרתים.
התראות נמחקות אוטומטית אחרי 30 יום.
וכשמוחקים חשבון - הכל נמחק לצמיתות תוך 48 שעות.
נקודה.`,
  },
  {
    question: "איך אני יודע שזה באמת עובד?",
    answer: `תקבלו נתונים בזמן אמת מרגע ההתקנה.
רוצים לבדוק? שלחו לילד הודעה "מעניינת" ותראו אם מגיעה התראה 😉
כרגע כל מי שמצטרף מקבל 14 יום ניסיון חינם לחבילת Premium - בלי להכניס כרטיס אשראי, בלי התחייבות.
פשוט תבדקו אותנו.`,
  },
  {
    question: "איך מבטלים ומוחקים הכל?",
    answer: `בלחיצה אחת מההגדרות.
אין שאלות, אין ניסיונות שכנוע.
המחיקה מלאה ומיידית - אנחנו לא שומרים שום דבר אחרי שביקשתם למחוק.
הנתונים שלכם הם שלכם.`,
  },
];

export function LandingFAQ() {
  return (
    <section id="faq" className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16">
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
                  <span className="text-lg lg:text-xl font-medium text-foreground">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 lg:text-lg whitespace-pre-line text-right">
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

import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export default function TermsOfService() {
  return (
    <LegalPageLayout title="תנאי שימוש - KippyAI">
      <p className="text-muted-foreground mb-8">עדכון אחרון: דצמבר 2024</p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">1. הסכמה לתנאים</h2>
        <p className="text-muted-foreground leading-relaxed">
          ברוכים הבאים ל-KippyAI. בשימוש באפליקציה או בשירותים שלנו, אתם מסכימים לתנאי שימוש אלה. 
          אם אינכם מסכימים לתנאים, אנא הימנעו משימוש בשירות.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">2. תיאור השירות</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          KippyAI היא אפליקציית בקרת הורים המספקת:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>ניטור תקשורת דיגיטלית של הילד בפלטפורמות שונות (WhatsApp, Telegram, Discord, TikTok ועוד)</li>
          <li>ניתוח תוכן באמצעות בינה מלאכותית לזיהוי תוכן מדאיג</li>
          <li>התראות להורים כאשר מזוהה תוכן בעייתי</li>
          <li>לוח בקרה להורים עם נתוני שימוש באפליקציות</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">3. זכאות לשימוש</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          השירות מיועד להורים או אפוטרופוסים חוקיים בלבד. בשימוש בשירות אתם מצהירים כי:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>אתם מעל גיל 18</li>
          <li>אתם ההורה או האפוטרופוס החוקי של הילד שעל מכשירו מותקנת האפליקציה</li>
          <li>יש לכם הסמכות החוקית להתקין אפליקציית ניטור על מכשיר הילד</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">4. מחירון ותשלומים</h2>
        
        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.1 חבילת Basic (חינם)</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>ניטור ילד אחד</li>
          <li>התראות בסיסיות</li>
          <li>היסטוריה של 7 ימים</li>
        </ul>

        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">4.2 חבילת Premium (בתשלום)</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>ניטור עד 5 ילדים</li>
          <li>התראות מתקדמות עם הקשר</li>
          <li>היסטוריה של 30 יום</li>
          <li>דוחות שבועיים</li>
          <li>תמיכה עדיפה</li>
        </ul>

        <p className="text-muted-foreground leading-relaxed mt-4">
          המחירים עשויים להשתנות. שינויים במחיר יחולו על תקופת החיוב הבאה לאחר הודעה מראש.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">5. אחריות המשתמש</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          בשימוש בשירות אתם מתחייבים:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>להשתמש בשירות בהתאם לחוק בלבד</li>
          <li>להתקין את האפליקציה רק על מכשירים של ילדים שאתם אחראים להם חוקית</li>
          <li>לא להשתמש בשירות לניטור בגירים ללא הסכמתם</li>
          <li>לשמור על אבטחת פרטי הגישה לחשבון שלכם</li>
          <li>לא לנסות לפרוץ, להפריע או לפגוע בשירות</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">6. מגבלות השירות</h2>
        
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong className="text-foreground">אין אחריות לדיוק מלא:</strong> מערכת ה-AI שלנו משתפרת כל הזמן, 
          אך אינה מושלמת. ייתכנו התראות שווא או החמצה של תוכן מדאיג. 
          האפליקציה אינה תחליף לפיקוח הורי ישיר.
        </p>
        
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong className="text-foreground">תלות בפלטפורמות צד שלישי:</strong> יכולות הניטור תלויות בפלטפורמות 
          שהילד משתמש בהן. שינויים בפלטפורמות אלה עשויים להשפיע על השירות.
        </p>
        
        <p className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">זמינות השירות:</strong> אנו שואפים לזמינות מקסימלית, 
          אך לא נוכל להבטיח שירות ללא הפסקות. תחזוקה מתוכננת תתואם מראש.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">7. הגבלת אחריות</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          השירות מסופק "כמות שהוא" (AS IS). במידה המרבית המותרת בחוק, 
          איננו אחראים לכל נזק ישיר, עקיף, מקרי או תוצאתי הנובע משימוש או חוסר יכולת להשתמש בשירות.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          בפרט, איננו אחראים לנזקים הנובעים מ:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>אי זיהוי תוכן מדאיג</li>
          <li>התראות שווא</li>
          <li>הפרעות בשירות</li>
          <li>גישה לא מורשית לחשבון עקב רשלנות המשתמש</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">8. סיום השירות</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong className="text-foreground">ביטול על ידי המשתמש:</strong> תוכלו לבטל את החשבון בכל עת 
          דרך הגדרות החשבון או ביצירת קשר עם התמיכה.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">ביטול על ידינו:</strong> אנו שומרים לעצמנו את הזכות 
          להשעות או לסיים חשבונות שמפרים את תנאי השימוש.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">9. קניין רוחני</h2>
        <p className="text-muted-foreground leading-relaxed">
          כל הזכויות באפליקציה, כולל קוד, עיצוב, לוגו וסימנים מסחריים, שייכות ל-KippyAI. 
          השימוש בשירות אינו מעניק לכם זכויות קניין רוחני כלשהן בשירות.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">10. שינויים בתנאים</h2>
        <p className="text-muted-foreground leading-relaxed">
          אנו עשויים לעדכן תנאים אלה מעת לעת. שינויים מהותיים יפורסמו באפליקציה או יישלחו בדואר אלקטרוני. 
          המשך השימוש בשירות לאחר השינויים מהווה הסכמה לתנאים המעודכנים.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">11. דין חל וסמכות שיפוט</h2>
        <p className="text-muted-foreground leading-relaxed">
          תנאי שימוש אלה כפופים לדיני מדינת ישראל. 
          כל מחלוקת תתברר בבתי המשפט המוסמכים במחוז תל אביב-יפו.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">12. יצירת קשר</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          לשאלות בנוגע לתנאי שימוש אלה, ניתן לפנות אלינו:
        </p>
        <ul className="list-none text-muted-foreground space-y-2">
          <li>
            דואר אלקטרוני:{' '}
            <a href="mailto:yariv@kippyai.com" className="text-primary hover:underline">
              yariv@kippyai.com
            </a>
          </li>
          <li>
            וואטסאפ:{' '}
            <a href="https://wa.me/972548383340" className="text-primary hover:underline">
              054-838-3340
            </a>
          </li>
        </ul>
      </section>

      <p className="text-sm text-muted-foreground mt-12 pt-8 border-t border-border">
        © 2024 KippyAI. כל הזכויות שמורות.
      </p>
    </LegalPageLayout>
  );
}

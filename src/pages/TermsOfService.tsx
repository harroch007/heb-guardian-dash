import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export default function TermsOfService() {
  return (
    <LegalPageLayout title="תנאי שימוש - KippyAI">
      <p className="text-muted-foreground mb-4">טיוטת V2 מעודכנת: אוגוסט 2026</p>
      <div className="mb-8 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed text-foreground" role="note">
        נוסח זה משקף את יכולות מוצר V2 הנוכחי, אך אינו נוסח משפטי סופי. נדרש אישור משפטי לפני השקת פרודקשן או גביית תשלום.
      </div>

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
          KippyAI היא מערכת בטיחות לילדים המספקת כיום:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>ניטור WhatsApp במכשיר Android של הילד, לאחר התקנה ואישור מפורש של ההורה</li>
          <li>סינון מקומי במכשיר וזיהוי אירועים שמצדיקים בדיקה מתקדמת</li>
          <li>ניתוח הקשר מתקדם והתראות להורה רק לאחר אישור אירוע בטיחות</li>
          <li>לוח הורה המציג תקינות ניטור, הרשאות והתראות מאומתות</li>
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
        <h2 className="text-2xl font-semibold text-foreground mb-4">4. שלב בדיקות וזמינות מסחרית</h2>
        <p className="text-muted-foreground leading-relaxed mt-4">
          גרסת V2 נמצאת בשלב בדיקות ואינה מפעילה כעת מסלול חיוב מסחרי. לפני גביית תשלום
          יפורסמו מחירון, תנאי ביטול ותנאים מסחריים מעודכנים ויינתן למשתמש אישור מפורש.
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
          <strong className="text-foreground">תלות ב־WhatsApp וב־Android:</strong> שינוי במבנה המסך,
          בהרשאות מערכת ההפעלה או במדיניות הפלטפורמה עשוי להשפיע על קליטת ההודעות ועל השירות.
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
        © 2026 KippyAI. כל הזכויות שמורות.
      </p>
    </LegalPageLayout>
  );
}

import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="מדיניות פרטיות - KippyAI">
      <p className="text-muted-foreground mb-4">טיוטת V2 מעודכנת: אוגוסט 2026</p>
      <div className="mb-8 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed text-foreground" role="note">
        מסמך זה עודכן כדי לשקף את מוצר Kippy V2 הנוכחי. לפני השקת פרודקשן נדרש אישור משפטי מלא של הנוסח, תקופות השמירה והתחייבויות הספקים.
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">מבוא</h2>
        <p className="text-muted-foreground leading-relaxed">
          ברוכים הבאים ל-KippyAI. אנו מחויבים להגנה על פרטיותכם ופרטיות ילדיכם. 
          מדיניות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-4">
          KippyAI היא מערכת בטיחות לילדים המתמקדת כיום בניטור WhatsApp במכשירי Android.
          המערכת מנתחת במכשיר הילד טקסט ותמלול של הודעות קוליות שהופיעו לילד, ומעבירה
          לבדיקה חיצונית רק אירועים שמצדיקים ניתוח מתקדם והקשר רלוונטי.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">המידע שאנו אוספים</h2>
        
        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">מידע על ההורה/משתמש</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>שם מלא וכתובת דואר אלקטרוני</li>
          <li>מספר טלפון (אופציונלי)</li>
          <li>פרטי התחברות לחשבון</li>
          <li>העדפות התראות</li>
        </ul>

        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">מידע על הילד</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>שם תצוגה של הילד לצורך זיהוי אצל ההורה</li>
          <li>שנת לידה או קבוצת גיל לצורך התאמת ניתוח הסיכון</li>
          <li>מזהי התקנה ומכשיר הדרושים לחיבור ולבדיקת תקינות הניטור</li>
        </ul>

        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">נתוני תקשורת</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>טקסט ותמלול שנקלטו מ־WhatsApp בעת שהופיעו במכשיר הילד</li>
          <li>הקשר שיחה מקומי לפי צ׳אט, לרבות כיוון ההודעה, סוג הצ׳אט ומועד ההודעה</li>
          <li>מעטפת אירוע והקשר רלוונטי רק כאשר נדרשת בדיקה מתקדמת</li>
          <li>סיכום מצומצם ובטוח להורה רק לאחר שאירוע אושר כהתראת בטיחות</li>
        </ul>

        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">מצב מכשיר וניטור</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>מצב ארבע הרשאות הניטור הנדרשות</li>
          <li>גרסת האפליקציה, זמן דיווח אחרון ומצב חיבור</li>
          <li>אחוז סוללה לצורך אבחון הפסקת ניטור</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">כיצד אנו משתמשים במידע</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>זיהוי סיכוני בטיחות והבנת ההקשר שבו נאמרו הדברים</li>
          <li>שליחת התראות מאומתות והכוונה רגועה להורה</li>
          <li>הצגת תקינות הניטור וההרשאות במכשיר הילד</li>
          <li>בדיקות איכות ושיפור דיוק המערכת תוך מזעור מידע</li>
          <li>תקשורת עמכם בנוגע לשירות</li>
          <li>עמידה בדרישות חוקיות</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">שמירת מידע ומחיקה</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>מחסנית השיחה נשמרת במכשיר הילד בלבד, לפי FIFO: עד 40 הודעות בצ׳אט פרטי ועד 60 בקבוצה</li>
          <li>הודעה נמחקת מהמחסנית המקומית כאשר היא נדחפת החוצה או לאחר 30 יום, המוקדם מביניהם</li>
          <li>בשרת נשמרים נתוני חשבון, חיבור מכשיר, בריאות ניטור ואירועי בטיחות שאושרו בלבד</li>
          <li>תקופות השמירה המדויקות בשרת והליך המחיקה יאושרו משפטית לפני השקת פרודקשן</li>
          <li>ניתן לפנות אלינו בבקשת עיון, תיקון או מחיקה בהתאם לדין החל</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">אבטחת מידע</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          אנו משתמשים באמצעי אבטחה מתקדמים להגנה על המידע שלכם:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>הצפנת תעבורה באמצעות SSL/TLS</li>
          <li>בקרות גישה והפרדה בין משפחות וחשבונות</li>
          <li>מזעור מזהים והפרדת זהות הילד מהתוכן שנשלח לניתוח מתקדם</li>
          <li>ניטור אבטחה ותיעוד גישה בהתאם למדיניות שתאושר לפני ההשקה</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">הזכויות שלכם</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          בהתאם לחוק הגנת הפרטיות, יש לכם הזכות:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>לגשת למידע שנאסף אודותיכם</li>
          <li>לתקן מידע שגוי</li>
          <li>למחוק את המידע שלכם</li>
          <li>לבטל הסכמה לעיבוד מידע</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">שיתוף עם צדדים שלישיים</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          איננו מוכרים את המידע שלכם. אנו משתפים מידע רק במקרים הבאים:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>ספקי תשתית וניתוח AI, ורק במידה הדרושה להפעלת השירות ובכפוף להסכמים מתאימים</li>
          <li>דרישות חוקיות - צו בית משפט או דרישה חוקית</li>
          <li>הגנה על ביטחון - במקרים קיצוניים של סכנה לחיים</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">פרטיות ילדים</h2>
        <p className="text-muted-foreground leading-relaxed">
          אנו מודעים לרגישות המיוחדת של מידע הנוגע לקטינים. 
          המערכת מתוכננת לאסוף את המינימום ההכרחי של מידע, 
          תוך מתן עדיפות לפרטיות הילד. אנו לא משתפים מידע על ילדים עם צדדים שלישיים 
          למטרות שיווקיות בשום מקרה.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">עדכונים למדיניות</h2>
        <p className="text-muted-foreground leading-relaxed">
          אנו עשויים לעדכן מדיניות זו מעת לעת. 
          שינויים מהותיים יפורסמו באפליקציה ויישלחו בדואר אלקטרוני.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">יצירת קשר</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          לשאלות בנוגע למדיניות הפרטיות או לבקשות הנוגעות למידע שלכם, ניתן לפנות אלינו:
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

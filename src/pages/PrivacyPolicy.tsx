import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="מדיניות פרטיות - KippyAI">
      <p className="text-muted-foreground mb-8">עדכון אחרון: דצמבר 2024</p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">מבוא</h2>
        <p className="text-muted-foreground leading-relaxed">
          ברוכים הבאים ל-KippyAI. אנו מחויבים להגנה על פרטיותכם ופרטיות ילדיכם. 
          מדיניות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-4">
          KippyAI היא אפליקציית בקרת הורים המאפשרת מעקב אחר תקשורת דיגיטלית של ילדים, 
          עם דגש על פרטיות ואבטחת מידע. אנו משתמשים בבינה מלאכותית לניתוח תוכן מדאיג, 
          תוך שמירה על פרטיות הילד ככל הניתן.
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
          <li>שם הילד (לזיהוי במערכת)</li>
          <li>גיל (לצורך התאמת רמת הניטור)</li>
          <li>מזהה המכשיר</li>
        </ul>

        <h3 className="text-xl font-medium text-foreground mt-6 mb-3">נתוני תקשורת</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>הודעות שזוהו כמדאיגות בלבד (לא כל התקשורת)</li>
          <li>מטא-דאטה של שיחות (שעה, אפליקציה, משך)</li>
          <li>נתוני שימוש באפליקציות</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">כיצד אנו משתמשים במידע</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>זיהוי תוכן מדאיג והתראה להורים</li>
          <li>יצירת דוחות שימוש ומגמות</li>
          <li>שיפור דיוק מערכת הזיהוי</li>
          <li>תקשורת עמכם בנוגע לשירות</li>
          <li>עמידה בדרישות חוקיות</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">שמירת מידע ומחיקה</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>התראות נשמרות למשך 30 יום בלבד</li>
          <li>נתוני שימוש באפליקציות נשמרים למשך 90 יום</li>
          <li>ניתן לבקש מחיקת כל המידע בכל עת</li>
          <li>מחיקת מידע תתבצע תוך 48 שעות מהבקשה</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">אבטחת מידע</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          אנו משתמשים באמצעי אבטחה מתקדמים להגנה על המידע שלכם:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mr-4">
          <li>הצפנת תעבורה באמצעות SSL/TLS</li>
          <li>הצפנת מידע רגיש בבסיס הנתונים</li>
          <li>אימות דו-שלבי (בקרוב)</li>
          <li>ניטור אבטחה שוטף</li>
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
          <li>ספקי שירות (אחסון, ניתוח AI) - עם הסכמי סודיות</li>
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
            <a href="mailto:support@kippyai.com" className="text-primary hover:underline">
              support@kippyai.com
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

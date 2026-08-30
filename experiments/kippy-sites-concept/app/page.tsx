import Image from "next/image";
import { SignalDemo } from "./signal-demo";

const EARLY_ACCESS_URL = "https://www.kippyai.com/auth?signup=true";
const LOGIN_URL = "https://www.kippyai.com/auth";

const principles = [
  {
    number: "01",
    eyebrow: "גבולות ברורים",
    title: "הטלפון מקבל מסגרת שהמשפחה יכולה להבין.",
    description:
      "KippyAI נבנית כדי לרכז זמן מסך, אפליקציות, לוחות זמנים ומיקום בממשק הורה אחד — בלי להפוך כל כלל לעוד ויכוח.",
    accent: "mint",
  },
  {
    number: "02",
    eyebrow: "אותות בזמן",
    title: "פחות הצפה. יותר הקשר לרגע שכדאי לבדוק.",
    description:
      "במקום פיד של שיחות, הכיוון הוא להציג אירוע בטיחות שעבר בדיקה, הסבר קצר והצעה לצעד רגוע שאפשר לעשות עכשיו.",
    accent: "gold",
  },
  {
    number: "03",
    eyebrow: "מרחב לגדול",
    title: "נוכחות הורית שלא מרגישה כמו חקירה.",
    description:
      "הכללים והאותות נועדו לעזור לפתוח שיחה, לבנות אחריות ולתת לילדים יותר עצמאות — כשההורה עדיין קרוב מספיק.",
    accent: "coral",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "נרשמים לגישה מוקדמת",
    description: "פותחים פרופיל הורה ומצטרפים לפתיחת הגישה המדורגת.",
  },
  {
    number: "02",
    title: "מוסיפים ילד או ילדה",
    description: "יוצרים את אזור המשפחה ומקבלים קוד חיבור ייעודי למכשיר.",
  },
  {
    number: "03",
    title: "מחברים Android בשקיפות",
    description: "סורקים QR, משלימים את ההתקנה ומאשרים את ההרשאות בגלוי במכשיר הילד.",
  },
  {
    number: "04",
    title: "רואים רק את מה שחשוב",
    description: "מצב המכשיר, הגבולות שהוגדרו ואירועים שאושרו להצגה להורה — במקום זרם של מידע גולמי.",
  },
] as const;

const faq = [
  {
    question: "האם KippyAI כבר פתוחה לכולם?",
    answer:
      "עדיין לא. KippyAI נמצאת בשלב אינטגרציה וגישה מוקדמת. אנחנו פותחים את הגישה בהדרגה, ובקשת הצטרפות אינה מבטיחה פתיחה מיידית של כל היכולות.",
  },
  {
    question: "באילו מכשירים משתמשים?",
    answer:
      "בשלב הראשון אפליקציית ההגנה מיועדת למכשיר Android של הילד או הילדה. ההורה משתמש בממשק Web/PWA מהטלפון או מהמחשב.",
  },
  {
    question: "האם ההורה רואה את כל הודעות ה-WhatsApp?",
    answer:
      "לא. כיוון המוצר שאושר אינו כולל ארכיון שיחות שגרתי להורה. המטרה היא להציג אירוע בטיחות מאושר, הקשר רלוונטי והמלצה לצעד הבא — לא פיד של הודעות יום-יומיות.",
  },
  {
    question: "האם KippyAI מנתחת גם קול ורשתות חברתיות נוספות?",
    answer:
      "לא בשלב הגישה המוקדמת הנוכחי. בטיחות WhatsApp בטקסט היא חלק מכיוון המוצר המאוחד; קול ופלטפורמות נוספות אינן מוצגות כאן כיכולות זמינות.",
  },
  {
    question: "האם KippyAI מחליפה שיקול דעת הורי?",
    answer:
      "לא. KippyAI נועדה לעזור לזהות רגע שכדאי לבדוק ולפתוח שיחה רגועה. היא אינה אבחון, הבטחת מניעה או תחליף לעזרה מקצועית ודחופה כשצריך.",
  },
] as const;

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        דילוג לתוכן הראשי
      </a>

      <header className="site-header" id="top">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="KippyAI — חזרה לראש הדף">
            <span className="brand-mark" aria-hidden="true">
              <Image src="/kippy-mascot.png" alt="" width={54} height={54} priority />
            </span>
            <span className="brand-word" dir="ltr">
              Kippy<span>AI</span>
            </span>
          </a>

          <nav className="main-nav" aria-label="ניווט ראשי">
            <a href="#approach">הגישה</a>
            <a href="#product">מה אנחנו בונים</a>
            <a href="#transparency">שקיפות</a>
            <a href="#questions">שאלות</a>
          </nav>

          <div className="header-actions">
            <a className="login-link" href={LOGIN_URL}>
              כניסה
            </a>
            <a className="button button-small" href={EARLY_ACCESS_URL}>
              גישה מוקדמת
            </a>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="signal-dot" aria-hidden="true" />
              KippyAI נבנית עכשיו · גישה מוקדמת
            </p>
            <h1 id="hero-title">
              לתת להם מרחב.
              <span> לדעת מתי להיות שם.</span>
            </h1>
            <p className="hero-lead">
              מערכת אחת להורות בעולם הדיגיטלי: גבולות ברורים בטלפון, תמונת מצב נגישה
              ואות ממוקד כשיש משהו שכדאי לבדוק — בלי להפוך את חיי הילד לפיד.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={EARLY_ACCESS_URL}>
                מבקשים גישה מוקדמת
                <span aria-hidden="true">←</span>
              </a>
              <a className="button button-secondary" href="#product">
                מגלים מה אנחנו בונים
              </a>
            </div>
            <p className="hero-note">
              <span aria-hidden="true">●</span>
              Android במכשיר הילד · ממשק Web/PWA להורה · פתיחה מדורגת
            </p>
          </div>

          <div className="hero-visual">
            <div className="photo-frame">
              <Image
                src="/kippy-family-conversation.png"
                alt="הורה וילד בשיחה רגועה בבית, כשהטלפון מונח בצד"
                fill
                priority
                sizes="(max-width: 920px) 100vw, 50vw"
              />
            </div>
            <div className="hero-caption">
              <span className="caption-signal" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>
                <small>העיקרון שמוביל אותנו</small>
                הטלפון בצד. השיחה במרכז.
              </span>
            </div>
            <div className="hero-badge" aria-hidden="true">
              <b>אות</b>
              <span>בתוך הרעש</span>
            </div>
          </div>
        </section>

        <section className="principle-strip" aria-label="שלושת עקרונות KippyAI">
          <p>גבולות ברורים</p>
          <span aria-hidden="true" />
          <p>אותות בזמן</p>
          <span aria-hidden="true" />
          <p>יותר מקום לגדול</p>
        </section>

        <section className="approach-section" id="approach" aria-labelledby="approach-title">
          <div className="section-intro">
            <p className="section-kicker">הדרך השלישית</p>
            <h2 id="approach-title">לא לקרוא הכול. לא להישאר בחושך.</h2>
          </div>
          <div className="approach-copy">
            <p>
              הורים לא צריכים לבחור בין מעקב פולשני לבין תחושה שהם עלולים לפספס משהו
              חשוב. KippyAI נבנית כדי לחבר שני צרכים שבדרך כלל מופרדים: מסגרת ברורה
              לשימוש בטלפון, והבנת הקשר כשעולה סימן שכדאי לבדוק.
            </p>
            <p className="approach-emphasis">
              לא עוד מידע להורה. מידע טוב יותר, ברגע הנכון, עם דרך אנושית לגשת אליו.
            </p>
          </div>
        </section>

        <section className="product-section" id="product" aria-labelledby="product-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">מוצר אחד, לא אוסף כלים</p>
              <h2 id="product-title">כך נראית הורות דיגיטלית רגועה יותר.</h2>
            </div>
            <p>
              הכיוון המאוחד של KippyAI מחבר בין שגרת הטלפון לבין רגעי הבטיחות — באותו
              מרחב, באותה שפה, ובלי הבטחות מוחלטות.
            </p>
          </div>

          <div className="principles-grid">
            {principles.map((principle) => (
              <article className={`principle-card principle-${principle.accent}`} key={principle.number}>
                <div className="principle-topline">
                  <span>{principle.number}</span>
                  <i aria-hidden="true" />
                </div>
                <p className="card-eyebrow">{principle.eyebrow}</p>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="signal-section" aria-labelledby="signal-title">
          <div className="signal-copy">
            <p className="section-kicker section-kicker-light">מרעש לאות</p>
            <h2 id="signal-title">אות הוא התחלה לבדיקה. לא מסקנה על הילד.</h2>
            <p>
              המטרה אינה להציף כל דבר חריג, אלא לעבור דרך בדיקה, לשמור על ההקשר הנחוץ
              ולהציג להורה ניסוח זהיר שאפשר לפעול לפיו. ההמחשה כאן משתמשת במידע סינתטי
              בלבד ומציגה את חוויית היעד.
            </p>
            <div className="signal-rule">
              <span aria-hidden="true">01</span>
              <p>מתחילים במה שחשוב, מסבירים אי-ודאות ומציעים צעד רגוע.</p>
            </div>
          </div>
          <SignalDemo />
        </section>

        <section className="steps-section" aria-labelledby="steps-title">
          <div className="section-heading section-heading-compact">
            <div>
              <p className="section-kicker">מסלול פשוט ושקוף</p>
              <h2 id="steps-title">מהרשמה ועד חיבור המשפחה.</h2>
            </div>
            <p>בלי הבטחות זמן ובלי התקנה נסתרת. כל שלב גלוי להורה ולילד.</p>
          </div>

          <ol className="steps-list">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="transparency-section" id="transparency" aria-labelledby="transparency-title">
          <div className="transparency-intro">
            <p className="section-kicker">אמון מתחיל במה שלא מסתירים</p>
            <h2 id="transparency-title">הילד יודע שההגנה פעילה. ההורה לא מקבל ארכיון שיחות.</h2>
            <p>
              החוזה המוצרי של KippyAI שם שקיפות בתוך החוויה: אפליקציית הילד גלויה
              ומינימלית, וממשק ההורה מיועד למצב המכשיר, לגבולות ולאירועי בטיחות שאושרו
              להצגה — לא לשגרת ההודעות.
            </p>
          </div>

          <div className="transparency-grid">
            <article>
              <span className="trust-label">במכשיר הילד</span>
              <h3>מצב הגנה ברור</h3>
              <p>חיווי גלוי שההגנה פעילה והנחיה כשנדרש לתקן הרשאה. בלי מידע הורה ובלי ממשק נסתר.</p>
            </article>
            <article>
              <span className="trust-label">בממשק ההורה</span>
              <h3>הקשר, לא פיד</h3>
              <p>תמונת מצב ואירוע שאושר להצגה, עם הסבר והצעה לצעד הבא — לא הודעות שגרתיות.</p>
            </article>
            <article>
              <span className="trust-label">לפני פתיחה רחבה</span>
              <h3>פרטים מלאים, לא סיסמאות</h3>
              <p>זרימת העיבוד, השמירה והמחיקה תפורסם בהתאם למימוש שעבר את שערי המוצר והפרטיות.</p>
            </article>
          </div>
        </section>

        <section className="questions-section" id="questions" aria-labelledby="questions-title">
          <div className="questions-heading">
            <p className="section-kicker">שאלות לפני שמצטרפים</p>
            <h2 id="questions-title">טוב לשאול. חשוב לענות ברור.</h2>
          </div>
          <div className="faq-list">
            {faq.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <i aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <div className="cta-mascot" aria-hidden="true">
            <Image src="/kippy-mascot.png" alt="" width={180} height={180} />
          </div>
          <div>
            <p className="section-kicker">KippyAI נבנית עם משפחות אמיתיות בראש</p>
            <h2 id="cta-title">רוצים להיות בין הראשונים שנכיר?</h2>
            <p>
              בקשו גישה מוקדמת. נעדכן כשהמסלול המתאים למשפחה שלכם ייפתח — בלי הבטחה
              שהכול זמין כבר עכשיו.
            </p>
          </div>
          <div className="cta-actions">
            <a className="button button-primary button-on-dark" href={EARLY_ACCESS_URL}>
              מבקשים גישה מוקדמת
              <span aria-hidden="true">←</span>
            </a>
            <a className="text-link" href="mailto:support@kippyai.com">
              יש לי שאלה לפני כן
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <a className="brand brand-footer" href="#top">
            <span className="brand-word" dir="ltr">
              Kippy<span>AI</span>
            </span>
          </a>
          <p>מערכת חכמה להורות בעולם הדיגיטלי · כרגע בגישה מוקדמת</p>
          <nav aria-label="קישורים משפטיים">
            <a href="https://www.kippyai.com/privacy">מדיניות פרטיות</a>
            <a href="https://www.kippyai.com/terms">תנאי שימוש</a>
            <a href="mailto:support@kippyai.com">יצירת קשר</a>
          </nav>
        </div>
        <p className="footer-disclaimer">
          KippyAI אינה תחליף לשיקול דעת הורי, לאבחון או לסיוע מקצועי ודחוף. עמוד זה
          מתאר כיוון מוצר בגישה מוקדמת ואינו התחייבות לזמינות של יכולת מסוימת.
        </p>
      </footer>
    </>
  );
}

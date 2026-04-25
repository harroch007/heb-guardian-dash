# שיפוץ דף הנחיתה V1 — עיצוב כהה חדש

מחליף את LandingV1 הקיים (הלבן) בעיצוב הכהה החדש לפי הטמפלט. נשמר אותו ה-route `/landing-v1`, אותם CTAs (waitlist), אותו NavbarV1 ו-Footer — רק האסתטיקה והתוכן של הסקשנים מתעדכנים.

## פלטת צבעים (dark cyber)
- רקע ראשי: `#0A0E1A` (כחול-שחור עמוק)
- רקע משני / כרטיסים: `#0F1729` עם `border #1E293B`
- אקסנט primary: cyan/teal (`#22D3EE` → `#06B6D4`) עם זוהר (glow shadows)
- טקסט: לבן/`slate-300` למשני
- שימוש ב-`hsl()` tokens חדשים שיוגדרו לוקאלית בקלאס scope `landingv1-dark`, **בלי** לגעת ב-`index.css` הגלובלי או לפגוע ב-V2/Home

## סקשנים לפי הטמפלט (12 חלקים)

1. **Navbar** (קיים `NavbarV1`) — רק רקע כהה + לוגו cyan + כפתור "הצטרפו לרשימת ההמתנה" cyan
2. **Hero חדש** — כותרת "פחות מלחמות על זמן מסך. יותר אחריות בבית." + תיאור + 2 CTAs ("הצטרפו לרשימת ההמתנה" + "ראו איך זה עובד") + microcopy "כמו דמי כיס. רק בדקות מסך." + **Mockups של 2 טלפונים ב-HTML/CSS** (mockup שמאל: סקירה כללית עם מד 120 דקות; mockup ימין: רשימת משימות עם 120 דקות בנק)
3. **"נשמע מוכר?"** — 3 כרטיסי ציטוטים של ילדים (אבא רק 5 דקות / אמא זה לא אני / אבל שכחתי) עם אייקונים `MessageCircle`/`Frown` במעגל cyan
4. **"הדור החדש של בקרת הורים"** — 3 כרטיסי ערך: אחריות שמתגמלת (`Trophy`), פחות ויכוחים (`MessageSquare`), גבולות ברורים (`ShieldCheck`)
5. **"זמן מסך יכול להפוך לכלי חינוכי"** — סקשן Coach Spotlight (החלפת `CoachSpotlight` הקיים): 3 כרטיסי מטבעות (סידור החדר +20, הוצאה לכלב +15, קריאה +15) + **בנק דקות mockup HTML/CSS** (צנצנת cyan עם 120 דקות) + 3 bullets עם אייקונים
6. **"כל מה שהורה צריך, במקום אחד"** — Features Grid 6 כרטיסים: ניהול זמן מסך (`Clock`), חסימת אפליקציות (`Lock`), לוחות זמנים (`Calendar`), מיקום והתראות (`MapPin`), בקשת זמן נוסף (`MessageCircle`), בנק דקות (`Coins`)
7. **"איך זה עובד?"** — 3 שלבים מימין לשמאל עם חיצים: ההורה מגדיר גבולות (1) → הילד מרוויח דקות (2) → הבית נרגע (3). אייקונים גדולים + מספרים cyan
8. **"למה הורים מתחברים לקיפי?"** — 4 trust pills: מערכת אחת (`Home`), אחריות לילד (`Handshake`), פחות מאבק (`Clock`), פחות כאב ראש (`Brain`) — שורה אחת עם אייקונים פשוטים
9. **Microcopy** — "נבנה עבור משפחות אמיתיות, מתוך הצרכים האמיתיים של הבית המודרני" + ✓ ירוק
10. **FAQ accordion** — 3 שאלות נפוצות (האם הילד יכול לבקש עוד זמן? איך עובדת מערכת המשימות? האם אפשר להגדיר חוקים שונים לכל ילד?) — שימוש ב-`@/components/ui/accordion`
11. **Final CTA** — "מוכנים להפוך את זמן המסך לכלי חינוכי?" + 2 כפתורים (הצטרפו לרשימת ההמתנה / קרוב) על רקע הדרגתי כהה עם איור משפחה (placeholder אייקוני: `Users` במעגל cyan עם glow)
12. **Footer** (קיים `FooterV1Expanded`) — נתאים רק את הצבעים לכהה אם צריך

## Mockups של טלפונים (HTML/CSS pure)

קומפוננטה חדשה `PhoneMockup.tsx` שמקבלת `variant: 'overview' | 'tasks'`:
- מסגרת iPhone: `rounded-[2.5rem] bg-slate-900 border-[8px] border-slate-800 shadow-2xl shadow-cyan-500/20`
- notch למעלה: `rounded-b-2xl bg-slate-950 w-24 h-6`
- תוכן פנימי לפי variant:
  - **overview**: Header "היי אבא 👋" + מד עיגול cyan עם "120 דקות מסך" + שורות סטטוס (זמן מסך היום 2.5h, אפליקציות, בקשות זמן 2) + bottom nav 4 אייקונים
  - **tasks**: Header ירוק "הצלחת! 120 דקות בבנק" + רשימת 3 משימות מסומנות (סידור חדר +20, הוצאה לכלב +15, קריאה 20 דק' +15) + bottom nav

הכל ב-Tailwind, ללא תמונות חיצוניות.

## בנק דקות mockup (Coach section)

קומפוננטה `CoinsJar.tsx`:
- צנצנת SVG inline: rect מעוגל עם `stroke-cyan-400` ו-`fill-cyan-500/10`, glow `drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]`
- בפנים: כיתוב "בנק דקות" + "120" cyan ענק + "דקות"
- מסביב: 3 חיצים בכיוון הצנצנת מ-3 כרטיסי המטבעות

## קבצים שיעודכנו / יווצרו

**יוחלפו (rewrite מלא):**
- `src/pages/LandingV1.tsx` — הסרת רקע לבן, הוספת `landingv1-dark` scope, הרכבת הסקשנים החדשים
- `src/components/landing-v1/HeroV1.tsx` — כותרת חדשה + 2 mockups
- `src/components/landing-v1/TrustBar.tsx` → ייהפך ל**EmpathyQuotes** (3 ציטוטי ילדים)
- `src/components/landing-v1/FeaturesGrid.tsx` — תוכן 6 הפיצ'רים החדש + עיצוב כהה
- `src/components/landing-v1/CoachSpotlight.tsx` — coach חדש עם CoinsJar
- `src/components/landing-v1/Differentiators.tsx` → ייהפך ל**ValuePillars** (3 כרטיסים: אחריות/ויכוחים/גבולות)
- `src/components/landing-v1/HowItWorks.tsx` — 3 שלבים בעיצוב כהה עם חיצים cyan
- `src/components/landing-v1/FreeAccessCTA.tsx` — Final CTA כהה
- `src/components/landing-v1/NavbarV1.tsx` — צבעים כהים (רקע `bg-slate-950/80 backdrop-blur` + לוגו cyan)
- `src/components/landing-v1/FooterV1Expanded.tsx` — התאמת צבעים לכהה (אם נדרש)

**חדשים:**
- `src/components/landing-v1/PhoneMockup.tsx` — mockup iPhone HTML/CSS עם 2 variants
- `src/components/landing-v1/CoinsJar.tsx` — צנצנת בנק דקות SVG
- `src/components/landing-v1/WhyParents.tsx` — 4 trust pills
- `src/components/landing-v1/FAQAccordion.tsx` — accordion 3 שאלות

## עקרונות שמור

- **RTL מלא** — `dir="rtl"` על container, פיזיקליות (mr/ml) ולא לוגיות
- **CTAs לא משתנים** — כולם פותחים `WaitlistModal` דרך `useWaitlist().openModal()` כשהדגל `WAITLIST_MODE=true`
- **Mobile-first** — grid responsive, mockups מתכווצים יפה במובייל
- **אנימציות** — שימור `framer-motion` כמו בקיים (fade-in-up בגלילה)
- **בלי mock data ב-app** — זה דף שיווקי, התוכן הסטטי הוא חלק מהמוצר
- **בלי לגעת** ב-V2, ב-`HomeV2`, או בכל route אחר. כל ה-scope תחת `/landing-v1` בלבד
- **Auth redirect** — שמירת הלוגיקה הקיימת (משתמש מחובר → `/home-v2`)

## תוצאה צפויה

`/landing-v1` ייראה כמעט זהה לטמפלט המצורף: רקע כהה כחול-שחור, אקסנטים cyan/teal זוהרים, 2 mockups של טלפונים מרשימים ב-Hero, סקשנים אמפתיים ("נשמע מוכר?"), והדגשה של ה-Coach (זמן מסך כדמי כיס) — הכל בעברית RTL, responsive, ועם אותם CTAs של רשימת ההמתנה.

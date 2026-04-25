# הפיכת /landing-v1 לרספונסיבי במובייל

## בעיות שזוהו ב-viewport 391px
1. **Hero** — שני טלפונים 240px כל אחד + gap זולגים מהמסך וגורמים ל-horizontal scroll
2. **Navbar** — לוגו + "התחברות" + "הצטרפו לרשימת ההמתנה" (טקסט ארוך) נדחסים/חורגים
3. **HeroV1 CTAs** — שני כפתורים `h-14 px-8` רחבים מדי
4. **CoachSpotlight** — `p-8 md:p-12` עודף; CoinsJar 200px גדול
5. **FreeAccessCTA** — `p-10 md:p-14` עודף במובייל
6. **FooterV1Expanded** — `grid md:grid-cols-4` נופל ל-1 עמודה במובייל (בזבוז שטח)

## שינויים מתוכננים

### `src/components/landing-v1/HeroV1.tsx`
- במובייל להציג טלפון אחד בלבד (variant `overview`); שני הטלפונים יוצגו רק מ-`sm:` ומעלה
- כפתורי CTA: `h-12 px-6 text-base sm:h-14 sm:px-8 sm:text-lg`
- כותרת: `text-3xl sm:text-4xl md:text-5xl lg:text-6xl`
- gap בין הטלפונים: `gap-2 sm:gap-4`

### `src/components/landing-v1/PhoneMockup.tsx`
- החלפת `style={{ width: 240 }}` ל-`className="w-[200px] sm:w-[240px]"` כדי לאפשר scaling במובייל

### `src/components/landing-v1/NavbarV1.tsx`
- קיצור הכפתור במובייל: "הצטרפו" עם `<span className="hidden sm:inline">לרשימת ההמתנה</span>`
- כפתור "התחברות" עם `text-xs sm:text-sm` ו-`px-2 sm:px-3`
- `gap-2` → `gap-1 sm:gap-2`

### `src/components/landing-v1/CoachSpotlight.tsx`
- padding כרטיס: `p-5 sm:p-8 md:p-12`
- כותרת: `text-2xl sm:text-3xl md:text-4xl lg:text-5xl`
- 3 task cards: לוודא שלא נחתכים (כבר `text-[11px]` — נשאר)
- CoinsJar wrapper: scaled responsive

### `src/components/landing-v1/CoinsJar.tsx`
- החלפת inline `style={{ width: 200, height: 240 }}` ל-`className="w-40 h-48 sm:w-[200px] sm:h-[240px]"`

### `src/components/landing-v1/FreeAccessCTA.tsx`
- padding: `p-6 sm:p-10 md:p-14`
- כותרת: `text-2xl sm:text-3xl md:text-5xl`
- כפתור CTA: `h-12 px-6 sm:h-14 sm:px-10`
- כפתור "קרוב" מושבת — להסתיר במובייל (`hidden sm:inline-flex`)

### `src/components/landing-v1/FooterV1Expanded.tsx`
- שינוי גריד מ-`grid md:grid-cols-4` ל-`grid grid-cols-2 md:grid-cols-4`
- בלוק לוגו יישאר `col-span-2` בשתי הרזולוציות
- padding footer: `py-10 md:py-14`

### `src/components/landing-v1/HowItWorks.tsx`
- בדיקה קלה — הוא כבר רספונסיבי, אעדכן רק padding כרטיסים אם נחוץ
- `p-5 sm:p-6` בכרטיסים

## מה לא משתנה
- כל הלוגיקה (WaitlistModal, ניווט, Auth)
- צבעים וטוקנים
- אנימציות framer-motion
- תוכן הטקסטים בעברית
- מבנה הסקציות

## אימות
לאחר היישום אצלם screenshot ב-viewport 391×844 ו-768×1024 כדי לוודא:
- אין horizontal scroll
- כל הכפתורים נראים במלואם
- הטלפון והצנצנת נכנסים יפה
- ה-Navbar נקי וקריא
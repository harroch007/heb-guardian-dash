## עיצוב מחדש של דפי V2 — שפה כהה אחידה (cyber/neon-teal)

### עקרונות ובטיחות
- **לא משנים פונקציונליות**: כל ה-fetches, RPCs, ניווטים, מודאלים, מצבי טעינה, BottomNavigationV2 — נשארים כפי שהם.
- **לא מוסיפים פיצ'רים שלא קיימים ב-DB**: העיצובים שצורפו מציגים "רצף הישגים", "היסטוריית משימות", "טיפ יומי", "Samsung Galaxy A54" וכו' — **לא ניצור** רכיבים חדשים שאין להם מקור נתונים. נשתמש רק בנתונים שכבר נטענים היום.
- **שפת עיצוב חדשה** (תואמת ל-LandingV1 החדש שבנינו): רקע `#0A0E1A`, כרטיסיות `#0F1525` עם בורדר `border-primary/20`, accent ציאן/טורקיז `hsl(174 62% 47%)` עם זוהר (`box-shadow: 0 0 20px hsl(var(--primary)/0.3)`), טקסט בהיר.
- **רספונסיביות מובייל-first**: כל הגרידים מתחילים ב-1 עמודה ועוברים ל-2/3/4 ב-`sm:`/`md:`/`lg:`. מקסימום רוחב `max-w-7xl` למסכי דסקטופ.

### 1. שכבת עיצוב משותפת
- **ב-`src/index.css`**: ליצור scope חדש `.v2-dark` (במקביל ל-`.homev2-light` הקיים) עם פלטה כהה:
  - `--background: 222 47% 6%` (≈ #0A0E1A)
  - `--card: 222 40% 11%` (≈ #0F1525)
  - `--primary: 174 72% 50%` (טורקיז זוהר)
  - `--border: 222 30% 22%`, `--muted: 222 30% 18%`, `--foreground: 0 0% 96%`
  - `font-family: 'Heebo', sans-serif`
  - utility classes: `.v2-card` (כרטיס עם זוהר עדין), `.v2-glow` (טקסט/אייקון זוהר), `.v2-stat-card` (קוביית מספרים).
- **ב-5 דפי V2**: להחליף `className="homev2-light ..."` ב-`className="v2-dark ..."`. שום שינוי במבנה ה-DOM הראשי או ב-`max-w-lg/2xl`.

### 2. `HomeV2.tsx` + רכיבי `home-v2/*`
- **לא משנים**: כל ה-`fetchAllData` והלוגיקה ב-`HomeV2.tsx` (שורות 1-340).
- **מעדכנים סגנון** ב:
  - `HomeGreeting` — כותרת עברית גדולה עם accent טורקיז על השם, אייקון waving hand.
  - `FamilyStatusHero` — קופסה כהה גדולה עם 3 מספרים זוהרים (ילדים / מחוברים / בעיות פתוחות) על רקע גרדיאנט עדין `from-primary/10 to-transparent`.
  - `ChildCardV2` — כרטיס כהה עם:
    - אווטאר עגול עם בורדר טורקיז
    - שם + כיתה + תג סטטוס מכשיר (LIVE ירוק / נותק אדום)
    - שורת מטריקות: זמן מסך היום, יתרת בנק דקות, התראות, בקשות זמן (כל אחד בקופסה זוהרת קטנה)
    - אם יש `activeRestriction` — באנר סגול/ענבר זוהר ("בית ספר 8:00-14:30")
    - כפתורי הפעולה הקיימים (פתח כרטיס ילד) — כפתור פס טורקיז
  - `AttentionSection` / `QuickActionsBar` / `DailyControlSummary` / `SmartProtectionSummary` — רקע `bg-card`, אייקונים בטורקיז, ספירת באדג'ים זוהרת.
- **לא נוסיף**: רצף-הישגים, היסטוריה, טיפים יומיים — אין להם DB.

### 3. `ChildControlV2.tsx` + `child-dashboard/*`
- **לא משנים**: useChildControls, polling, ringCommand, כל הפעולות.
- **מעדכנים סגנון**:
  - **Header**: שם הילד + תמונה עגולה + שורת סטטוס (סוללה/אחוז, רשת, "Samsung Galaxy A54" ← כן: זה כבר נטען מ-`devices` כ-`device_id`/דגם אם קיים; **לא** נוסיף שדה דגם חדש — נשאר עם המידע הקיים: סוללה, last_seen, address).
  - **Status Strip**: 4 קוביות מטריקות (זמן מסך חופשי / לוח פעיל / בקשות ממתינות / בונוס היום) — כולן כבר מחושבות בקוד.
  - **LocationSectionV2**: מפת OpenStreetMap עם בורדר טורקיז זוהר, תג LIVE.
  - **AppsSection**: כרטיסיות אפליקציות כהות עם אייקון, שם, סטטוס (מותר/חסום/מוגבל) ו-Switch בצבע טורקיז. **לא נוסיף** קטגוריות/חיפוש מתקדם — רק עיצוב מחדש של מה שקיים.
  - **SchedulesSection**: timeline אנכי כהה עם פסים צבעוניים לכל לו"ז (כפי שמוצג בעיצוב), פתיחה למודל עריכה הקיים.
  - **TimeRequestsCard**: כרטיסי בקשה עם כפתורי "אשר"/"דחה" טורקיז/אדום.
  - **GeofenceSection / ScreenTimeSection / ProblemBanner**: עדכון רקעים, בורדרים, אייקונים לפלטה הכהה.

### 4. `FamilyV2.tsx`
- **לא משנים**: כל ה-co-parent flow, invite codes, ring command.
- **מעדכנים**: כרטיסי סיכום (4 קוביות בגריד `grid-cols-2 md:grid-cols-4`), כרטיסי ילד (אווטאר + שם + תג מינוי + סטטוס מכשיר + כפתורי פעולה), section ההורה השותף בעיצוב כהה אחיד.

### 5. `ChoresV2.tsx`
- **לא משנים**: useChores hook, ChoreForm, ChoreList, RewardBankCard, אישורי משימות.
- **מעדכנים**: 4 קוביות הסיכום (פעילות/אושרו/בנק/בונוס) בעיצוב כהה זוהר; ChoreList עם פסי צבע טורקיז למשימות פעילות, ירוק מוצק למאושרות. RewardBankCard בכרטיס גדול כהה עם הצגת היתרה כמספר זוהר ענק.
- **לא נוסיף**: "רצף הישגים", "היסטוריית משימות שהושלמו" כמדור נפרד, "כללי בנק הדקות" — אין רכיבים/נתונים לאלה. נשאיר את `transactions` הקיים ב-`RewardBankCard` כפי שהוא.

### 6. `SettingsV2.tsx`
- **לא משנים**: כל ה-handlers (signOut, push subscribe, profile edit, WhatsApp links).
- **מעדכנים**: 6 ה-`<section>` הקיימים → כרטיסי `v2-card` כהים עם אייקונים זוהרים בטורקיז, מפרידי `border-border/30`, כפתורי outline בסגנון neon.

### 7. רכיבים משותפים שייגעו (סגנון בלבד, לא לוגיקה)
- `BottomNavigationV2` — רקע כהה `bg-card/80 backdrop-blur` עם בורדר עליון טורקיז עדין; אייקון פעיל זוהר.
- `EditChildModal`, `ReconnectChildModal`, `AddChildModal`, `ScheduleEditModal` — Dialog עם רקע כהה ובורדר טורקיז (משתמשים ב-tokens של `--popover`/`--border` שכבר מותאמים ב-`.v2-dark`, אז ירשו אוטומטית).

### 8. רספונסיביות
- כל הגרידים: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4`.
- כל הקונטיינרים: `max-w-lg` ב-Home/Family/Settings, `max-w-2xl` ב-Chores, `max-w-4xl` ב-ChildControlV2 (כדי לתת מקום למפה + sections).
- בדיקה ב-viewport 360px (מובייל) ו-1280px+ (דסקטופ).

### קבצים שייערכו
- `src/index.css` — הוספת scope `.v2-dark` (~50 שורות).
- `src/pages/HomeV2.tsx`, `FamilyV2.tsx`, `ChoresV2.tsx`, `SettingsV2.tsx`, `ChildControlV2.tsx` — החלפת `homev2-light` ל-`v2-dark` + עדכוני כיתות סגנון.
- `src/components/home-v2/*` — 6 קבצים (סגנון בלבד).
- `src/components/child-dashboard/*` — ~10 קבצים (סגנון בלבד).
- `src/components/chores/*` — 3 קבצים (סגנון בלבד).
- `src/components/BottomNavigationV2.tsx` — סגנון.

### מה **לא** נעשה (לפי בקשתך)
- ❌ לא נוסיף רצף-הישגים / היסטוריית משימות / טיפים יומיים / כללי בנק הדקות / שדה דגם מכשיר / חיפוש אפליקציות / קטגוריות אפליקציות.
- ❌ לא נשנה ניווט, כפתורים, חיבורי DB, Edge Functions, RPCs.
- ❌ לא ניגע ב-V1, ב-Landing, או בדפי /admin/*.

## מטרה
ניקוי רשימת האפליקציות באופן גורף (לא לפי יצרן), כך שההורה יראה רק אפליקציות "אמיתיות" שהילד באמת יכול להפעיל — ללא תלות בסמסונג/שיאומי/וכו'.

## עיקרון מנחה
**"Launchable Apps Only"** — אם לאפליקציה אין אייקון במסך הבית של אנדרואיד (אין launcher intent), היא לא רלוונטית להורה. זה תקן אנדרואיד אוניברסלי שעובד על כל יצרן.

## שלב 0 — מיידי (ללא תלות באנדרואיד)

### 0.1 שינוי `src/lib/appUtils.ts`
- מחיקת רוב הרשימה הקשיחה. נשארים רק רכיבי מערכת אמיתיים שאף פעם לא יהיו אפליקציה לילד:
  - `com.android.systemui`, `com.android.settings`, `com.google.android.gms`, `com.google.android.gsf`
  - `com.android.providers.*`, `com.android.packageinstaller`, `com.google.android.packageinstaller`
  - `com.android.bluetooth`, `com.android.nfc`, `com.android.stk`
  - launcher-ים: `com.sec.android.app.launcher`, `com.miui.home`, `com.android.launcher`
  - `com.kippy.*` (האפליקציה שלנו)
- מחיקה: AR Zone, "הקבצים שלי", Galaxy Store, Bixby, Samsung Pass, OneDrive, PowerPoint, Photos, Maps, Calendar, Meet, Clock, וכו' — אם הילד לא משתמש בהן הן ייעלמו ממילא דרך הסינון בשלב 0.2; אם הוא כן — נכון שההורה יראה.
- צמצום `SYSTEM_KEYWORDS` ל: `systemui`, `packageinstaller`, `providers`, `kippy` בלבד.

### 0.2 הוספת סינון "interaction-based" ב-`AppsSection.tsx` ו-`AppControlsList.tsx`
ברירת מחדל: אפליקציה תיכלל ברשימה רק אם מתקיים **לפחות אחד**:
- יש לה `app_policies` (ההורה כבר נגע בה), או
- יש לה `blocked_app_attempts` (הילד ניסה לפתוח), או
- יש לה `app_usage` עם דקות שימוש > 0 ביום כלשהו, או
- היא לא ב-`isSystemApp()` המצומצם (אפליקציית צד-שלישי "רגילה").

זה מבטיח שאפליקציות מערכת שהילד **כן** משתמש בהן (גלריה, מצלמה, AR Zone אם ניסה) יופיעו אוטומטית, ואפליקציות מערכת שהוא לא נוגע בהן לא יציפו את הרשימה.

### 0.3 כפתור "הצג הכל" בראש הרשימה
Toggle קטן (Switch + label "הצג אפליקציות מערכת") שמכבה את סינון 0.2 — להורה שרוצה לראות את כל 150 האפליקציות. כברירת מחדל כבוי.

### 0.4 קיבוץ ויזואלי לפי קטגוריה (אופציונלי בשלב הזה)
שימוש בעמודה `category` הקיימת ב-`installed_apps` (GAME, SOCIAL, COMMUNICATION, PRODUCTIVITY, OTHER) להצגת badges קטנים. ללא שינוי במבנה, רק תווית.

## שלב 1 — לעתיד (כשתהיה גישה לאנדרואיד)
**לא חלק מהיישום עכשיו**, רק תיעוד הכיוון:
- הוספת עמודה `is_launchable BOOLEAN` ל-`installed_apps`.
- האנדרואיד יחשב פעם אחת בעת איסוף הרשימה: `pm.getLaunchIntentForPackage(pkg) != null`.
- הסינון יעבור להיות חד-משמעי: `WHERE is_launchable = true`. נוכל למחוק את `isSystemApp()` כמעט לגמרי.

## תוצאה צפויה במכשיר של הילד שלך
- AR Zone → יופיע אוטומטית (יש לו blocked_attempts) ✅
- "עצות" → יישאר (יש לו policy) ✅
- 120 אפליקציות מערכת לא בשימוש (Bixby, OneDrive, Samsung Pass, PowerPoint וכו') → ייעלמו ✅
- אפליקציות שהילד יוריד בעתיד → יופיעו ב"ממתינות לאישור" כמו תמיד ✅

## קבצים שישתנו
- `src/lib/appUtils.ts` — צמצום הרשימה + ייצוא פונקציה חדשה `shouldShowApp(pkg, hasInteraction)`.
- `src/components/child-dashboard/AppsSection.tsx` — סינון interaction-based + toggle "הצג הכל".
- `src/components/controls/AppControlsList.tsx` — שימוש בלוגיקת הסינון החדשה.

ללא שינויי DB, ללא שינויי אנדרואיד, ללא שינויי edge functions.

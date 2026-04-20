

# פרומפט מפורט לסוכן Android — התאמת עיצוב אפליקציית הילד ל-V2

## מטרה
להפיק מסמך **`kippy-child-app-design-prompt.md`** — פרומפט עברי, מפורט, מוכן להעברה לסוכן AI שעובד על קוד האנדרואיד של הילד. הפרומפט יגדיר במדויק את שפת העיצוב של V2 (צבעים, פונטים, רכיבים) **בלי לדרוש שינוי במבני המסכים הקיימים** — רק רענון ויזואלי (skin) על גבי ה-layouts הקיימים.

## מה אעשה
1. אסרוק את `src/index.css` (`.homev2-light`), `tailwind.config.ts`, ורכיבי `home-v2/*` ו-`BottomNavigationV2.tsx` כדי לחלץ ערכים מדויקים
2. אפיק קובץ Markdown יחיד שמכיל:

### מבנה המסמך

**א. הקדמה ועקרונות**
- מה לעשות / מה לא לעשות (אסור לשנות לוגיקה, navigation, או מבני XML — רק styles, colors, typography)
- שמירה על RTL מלא, פונט Heebo, מגע ידידותי לילדים

**ב. פלטת צבעים — Android (HEX + שמות resources)**
טבלה מוכנה ל-`colors.xml`:
```xml
<color name="kippy_bg">#F7F7F7</color>          <!-- 0 0% 97% -->
<color name="kippy_card">#FFFFFF</color>
<color name="kippy_primary">#2DB3A6</color>     <!-- 174 62% 47% turquoise -->
<color name="kippy_primary_fg">#FFFFFF</color>
<color name="kippy_text">#212329</color>
<color name="kippy_text_muted">#6B7280</color>
<color name="kippy_border">#D9DCE0</color>
<color name="kippy_success">#27B47A</color>
<color name="kippy_warning">#F59E0B</color>
<color name="kippy_destructive">#DC3232</color>
```
+ הסבר מתי להשתמש בכל צבע + עקרון "primary turquoise = פעולה ראשית"

**ג. טיפוגרפיה**
- פונט: **Heebo** (Google Fonts) — להוסיף ל-`res/font/heebo_*.ttf`
- משקלים: 300/400/500/600/700/800
- היררכיה (sp values מותאמים ילדים, מעט גדולים יותר):
  - Display: 28sp / 700
  - H1: 22sp / 700
  - H2: 18sp / 600
  - Body: 16sp / 400
  - Caption: 13sp / 500
- `letterSpacing`, `lineHeight` מומלצים

**ד. רדיוסים, מרווחים, צללים**
- Card radius: 16dp (rounded-2xl)
- Button radius: 12dp
- Pill: 999dp
- Padding כרטיס: 16-20dp
- Spacing scale: 4/8/12/16/20/24dp
- Elevation: 2dp (sm), 4dp (md)

**ה. רכיבים — מפת המרה**
טבלה: רכיב V2 (web) ↔ מקבילה ב-Android XML
- Card → MaterialCardView (radius 16, stroke kippy_border, elevation 2)
- Primary Button → MaterialButton (background kippy_primary, text white, height 52dp, radius 12)
- Secondary Button → OutlinedButton (stroke kippy_primary)
- Input → TextInputLayout outlined
- Bottom Nav → BottomNavigationView (כבר קיים, רק צבעים)
- Avatar circle → ShapeableImageView circular
- Status pills → Chip (סוגים: success/warning/danger)

**ו. אייקונוגרפיה**
- ספרייה מקבילה ל-lucide → **Lucide for Android** (יש package) או SVG ידני
- גדלים: 16dp inline, 20dp action, 24dp header
- צבעים מותרים: text, primary, destructive

**ז. RTL ו-Hebrew**
- `android:supportsRtl="true"` במניפסט
- שימוש ב-`start/end` ולא `left/right`
- בדיקה ש-LayoutDirection=RTL

**ח. אנימציות ומיקרו-אינטראקציות**
- duration 150ms, AccelerateDecelerateInterpolator
- Ripple על כפתורים בצבע primary @ 20% alpha
- Confetti/celebration קל בהשלמת משימה (מותר להוסיף, מתאים לילדים)

**ט. הנחיות ספציפיות לילדים (מעל ה-base)**
- Touch targets מינימום 48dp (במקום 44 של ההורה)
- כפתורי פעולה ראשיים — גובה 56dp, פונט 18sp/700
- שימוש מוגבר ב-primary turquoise + accent ירוק להצלחה
- אווירה רגועה — ללא תפריטים עמוסים

**י. Checklist להטמעה (בסדר ביצוע)**
1. הוספת Heebo ל-`res/font/`
2. עדכון `colors.xml` עם הפלטה
3. עדכון `themes.xml` — primary, fontFamily, cornerRadius
4. החלפת רקעי כרטיסים ל-`kippy_card` + radius 16
5. עדכון כפתורים ל-style החדש
6. עדכון BottomNav לצבעי kippy_primary/text_muted
7. בדיקת RTL במכשיר אמיתי
8. QA: השוואה ויזואלית ל-screenshot של `/home-v2`

**יא. מה אסור לגעת**
- שמות classes, IDs, navigation graph
- Activity/Fragment lifecycle
- Network/DB code
- מבני XML של מסכים (רק attributes של style)

**יב. נספח — דוגמת Theme XML מוכנה**
בלוק `<style name="Theme.Kippy.Child" parent="Theme.MaterialComponents.DayNight.NoActionBar">` עם כל הצבעים והפונט מוגדרים

## תוצר
קובץ אחד: **`/mnt/documents/kippy-child-app-design-prompt.md`** — מוכן להעתקה ישירה ל-Cursor / Copilot / כל סוכן AI שעובד על הריפו של אנדרואיד.

## שאלה לאישור
האם להוסיף גם **screenshot reference** של `/home-v2` (תמונה מצורפת) כחלק מהמסמך, כדי שהסוכן השני יראה ויזואלית את היעד? המלצתי: כן — אצרף PNG של מסך הבית הנוכחי כקובץ נפרד ב-`/mnt/documents/`.


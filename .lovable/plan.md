

## תוכנית יישור UI — שבתות וחגים

### סיכום
הסרת כל ממשק ההזנה הידנית (אוטומטי/ידני, שעות כניסה/יציאה, שדות TimeInput) משורת השבת, שינוי הטקסט ל"שבתות וחגים", והוספת שורת עזר קצרה כשהמסלול פעיל.

### קובץ יחיד: `src/components/child-dashboard/SchedulesSection.tsx`

#### שינויים:

1. **טקסט**: שורה 152 — `"שבת"` → `"שבתות וחגים"`

2. **הסרת הבלוק המורחב כולו** (שורות 169–224): כל ה-block של `{shabbatRule?.is_active && (...)}` שמכיל:
   - Badge toggle אוטומטי/ידני
   - תצוגת כניסה/יציאה (`formatShabbatTime`)
   - שדות `TimeInput24h` ידניים
   - כפתור "שמור זמנים"

   במקומו — שורת עזר פשוטה:
   ```tsx
   {shabbatRule?.is_active && (
     <div className="mt-1.5 mr-6">
       <span className="text-[11px] text-muted-foreground">
         מחושב אוטומטית לפי מיקום הילד
       </span>
     </div>
   )}
   ```

3. **ניקוי קוד מת**: הסרת imports ומשתנים שלא בשימוש:
   - `import { Badge }` — לא בשימוש עוד
   - `import { TimeInput24h }` — לא בשימוש עוד
   - State variables: `savingShabbatMode`, `manualStart`, `manualEnd`
   - Computed values: `shabbatMode`, `dbManualStart`, `dbManualEnd`
   - Functions: `handleShabbatModeChange`, `handleSaveManualTimes`
   - Helper: `formatShabbatTime`
   - Props: `onUpdateShabbatMode`, `nextShabbat` — הסרה מה-interface ומה-destructuring

4. **Props interface**: הסרת `onUpdateShabbatMode` ו-`nextShabbat` מ-`SchedulesSectionProps`

5. **קריאות מהורה** (`ChildDashboard.tsx` או דומה): צריך לוודא שהם לא מעבירים props שהוסרו — אם כן, להסיר גם שם.

### קבצים שישתנו
| קובץ | שינוי |
|---|---|
| `SchedulesSection.tsx` | טקסט, הסרת manual UI, שורת עזר, ניקוי imports |
| קובץ ההורה שמעביר props | הסרת `onUpdateShabbatMode` ו-`nextShabbat` אם מועברים |


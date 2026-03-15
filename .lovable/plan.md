

## החזרת אפליקציית "הודעות" לתצוגה

### שינויים בקובץ `src/lib/appUtils.ts`

1. **הסרה מרשימת `SYSTEM_APPS_TO_HIDE`** — מחיקת 3 שורות:
   - `com.android.mms`
   - `com.google.android.apps.messaging`
   - `com.samsung.android.messaging`

2. **הסרה מרשימת `SYSTEM_KEYWORDS`** — הסרת `"messaging"` מהמערך

אחרי השינוי, אפליקציות הודעות יופיעו בניהול אפליקציות ובזמן מסך.


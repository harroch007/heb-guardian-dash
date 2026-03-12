

## הוספת אפליקציות "תמיד פתוחות" לרשימת הסינון

### הבעיה
אפליקציות מערכת שתמיד פועלות (הגדרות, חנות Play, חייגן, SMS, Kippy וכו') מופיעות ברשימת האפליקציות ומרעישות את הממשק.

### שינוי

**קובץ: `src/lib/appUtils.ts`**

הוספת חבילות חדשות ל-`SYSTEM_APPS_TO_HIDE` + מילות מפתח נוספות לבדיקת `includes`:

**חבילות להוספה:**
- `com.android.dialer` / `com.google.android.dialer` / `com.samsung.android.dialer` — חייגן
- `com.android.mms` / `com.google.android.apps.messaging` / `com.samsung.android.messaging` — הודעות SMS
- `com.android.stk` — SIM Toolkit
- `com.google.android.gsf` — Google Services Framework
- Kippy: תוספת `includes("kippy")` לתנאי הסינון

**מילות מפתח להוספת ב-`includes`:**
- `"launcher"` — כל לאנצ'ר
- `"dialer"` — כל חייגן
- `"messaging"` — כל אפליקציית הודעות מערכת
- `"packageinstaller"` — כבר מכוסה חלקית

שינוי בקובץ אחד בלבד, ~10 שורות.


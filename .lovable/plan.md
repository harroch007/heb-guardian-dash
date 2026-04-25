## הבעיה

ב-`/landing-v1` הכרטיס `InstallAppCard` כבר ממוקם בקוד (לפני הפוטר), אבל הוא לא נראה כי הוא מוסתר במקרים הבאים:

1. הדפדפן עדיין לא ירה את `beforeinstallprompt` (קורה רק ב-Chrome/Edge, ולעיתים מתעכב).
2. דפדפן שאינו Chrome ב-Android (Firefox/Samsung).
3. דסקטופ ללא Chrome — אין אפשרות התקנה כלל אז הכרטיס נעלם.
4. העיצוב של ה-`variant="landing"` משתמש ב-`bg-card border-border shadow-sm` — נראה דהוי על הרקע החשוך החדש של `/landing-v1`.

## הפתרון

### 1. שדרוג `src/components/InstallAppCard.tsx`
- **תמיד להציג את הכרטיס בדף הנחיתה** (לא רק כש-`isInstallable || isIOS`), כל עוד האפליקציה לא מותקנת.
- להוסיף **זיהוי Android בדפדפן שאינו Chrome** עם הוראות "פתחו ב-Chrome → תפריט → הוסף למסך הבית".
- להוסיף **מצב fallback לדסקטופ**: הסבר קצר "פתחו את האתר בטלפון כדי להתקין כאפליקציה" + הצעה לסרוק QR / לשתף קישור.
- שיפור עיצוב `variant="landing"` להתאים לתמה החשוכה החדשה של V1:
  - `bg-card/60 backdrop-blur border-primary/20`
  - אפקט זוהר עדין `shadow-[0_0_24px_hsl(var(--primary)/0.15)]`
  - אייקון בתוך עיגול `bg-primary/10 border border-primary/30` (במקום הלוגו על רקע בהיר)
  - כותרת בצבע `text-foreground`, תיאור ב-`text-muted-foreground`
- הוראות iOS — עדכון צבעי הטקסט להיראות נכון על רקע חשוך.

### 2. עדכון `src/pages/LandingV1.tsx`
- הזזת בלוק ה-`InstallAppCard` למיקום בולט יותר — אחרי `HowItWorks` או לפני `FreeAccessCTA`, עם מרווח אוויר נדיב (`py-12`).
- מעטפת `section` עם רקע מודגש כדי לא להיבלע בין הסקשנים.

### 3. שמירה על תאימות
- ה-`variant="settings"` נשאר כפי שהוא (משמש ב-`SettingsV2`/`Settings`) — לא נשנה את ההתנהגות שם.
- אם המשתמש כבר התקין (`isInstalled === true`) — עדיין מחזיר `null` (לא מציגים כרטיס מיותר).

## קבצים שיתעדכנו
- `src/components/InstallAppCard.tsx` — לוגיקת תצוגה + עיצוב חדש לתמה החשוכה
- `src/pages/LandingV1.tsx` — מיקום ומעטפת חדשים לסקשן ההתקנה

## מה לא נוגעים
- `usePWAInstall.ts` — לא צריך שינוי, ה-hook כבר מספק את כל המידע (`isInstalled`, `isInstallable`, `isIOS`, `isAndroid`).
- `vite.config.ts` / Service Worker — ההתקנה עצמה כבר עובדת, רק התצוגה הייתה חסרה.

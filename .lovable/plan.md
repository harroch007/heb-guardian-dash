# שחרור גרסה: דף נחיתה V1 + מסכי V2 בלבד

## המטרה
ביוזר שנכנס ל-`kippyai.com` יראה מיד את **דף הנחיתה החדש (LandingV1)**, וכל ניווט ימשיך אך ורק במסכי **V2**. הדף הישן (`Landing`) ומסכי V1 (Dashboard, Family, ChildDashboard, Alerts, Settings וכו׳) לא יוצגו יותר.

## שינויים מתוכננים

### 1. `src/App.tsx` — החלפת רכיב דף הבית
- שורה 63: `<Route path="/" element={<Landing />} />` → `<Route path="/" element={<LandingV1 />} />`
- הסרת ה־import של `Landing` (לא בשימוש יותר).
- שמירה על המסלול `/landing-v1` כ-alias (יציג גם הוא את `LandingV1`) כדי לא לשבור לינקים קיימים.

### 2. הפניית מסכי V1 הישנים ל-V2
כדי שאף משתמש (גם עם bookmark ישן) לא יראה V1, נחליף את ה-elements של המסלולים הישנים ב-`<Navigate replace>` למקבילים ב-V2:

| מסלול ישן | יפנה ל |
|---|---|
| `/dashboard` | `/home-v2` |
| `/family` | `/family-v2` |
| `/child/:childId` | `/child-v2/:childId` |
| `/alerts` | `/alerts-v2` |
| `/settings` | `/settings-v2` |
| `/chores` | `/chores-v2` |

הערה: גם דפי ה־demo (`DemoDashboard`, `DemoFamily` וכו׳) שמופעלים ב-`isDemoMode` יוסרו מהמסלולים האלה — חוויית הדמו תעבור גם היא דרך V2 (לא קיימים מסכי דמו ל-V2 כרגע, ולכן פשוט נפנה לכל המסכים האמיתיים; demo mode בפועל לא משמש פרודקשן).

### 3. `src/pages/Landing.tsx` — הפניית הקובץ הישן
לא נמחק את הקובץ (כדי לא לשבור imports שולפים), אבל אם נשארו import-ים — נסיר אותם מ-App.tsx. הקובץ עצמו יישאר בפרויקט אך לא ייטען לאף מסלול.

### 4. הפניות קיימות שכבר תקינות (לא דורש שינוי)
- `ProtectedRoute` כבר מפנה את משתמש מחובר ל-`/home-v2` ✓
- `LandingV1` כבר מפנה משתמש מחובר ל-`/home-v2` ✓
- כפתור התנתקות כבר מפנה ל-`/landing-v1` ✓ (בוצע במשימה קודמת)

### 5. דברים שלא נוגעים בהם
- **לא** נוגעים בלוגיקת ה-Auth, Waitlist, Onboarding או Admin.
- **לא** מוחקים את `Landing.tsx` הישן או את הקומפוננטות שלו (`src/components/landing/*`) — נשמרים בקוד למקרה של rollback.
- מסלולי Admin, Auth, Privacy, Terms, Install, Onboarding, Checkout, Periodic Summary, Daily Report, Notification Settings, Accept Invite, Join Family — נשארים כפי שהם.
- דפי `/next` ו-`/landing-v1` נשארים נגישים.

## תוצאה צפויה
1. כניסה ל-`kippyai.com` → דף נחיתה V1 (כשהמשתמש לא מחובר).
2. כניסה ל-`kippyai.com` כשמחובר → הפניה אוטומטית ל-`/home-v2`.
3. כל לינק/bookmark ישן ל-`/dashboard`, `/family`, `/child/:id`, `/alerts`, `/settings`, `/chores` → הפניה אוטומטית למקבילה ב-V2.
4. כל החוויה החדשה (דף נחיתה + V2) — הפעילה היחידה ליוזר.

## לאחר אישור התוכנית
לאחר ביצוע השינויים בקוד, תצטרך ללחוץ **Publish → Update** בלוונייבל כדי לשחרר את הגרסה לאוויר ב-`kippyai.com`.
## מטרה
לתת להורה נראות ופעולה מיידית על אפליקציה חדשה שממתינה לאישור — כמו שיש היום לבקשות זמן נוסף — וגם חיווי על טאבים בתחתית המסך כמו עיגול ספירה בנוטיפיקציות.

## מה קיים היום
- טריגר `on_app_alert_insert` כבר שולח Web Push להורה ברגע שנכנסת שורה ל-`app_alerts` (זה קורה דרך RPC `report_pending_app` → `create_app_alert`).
- קיים קומפוננט ישן `NewAppsCard` ב-Dashboard V1 שמציג אפליקציות שהותקנו היום, אבל הוא לא מחובר ל-HomeV2.
- ב-HomeV2 קיים `HomePendingTimeRequests` עם תבנית מצוינת לכרטיסיות פעולה מהירה (אישור/דחייה).
- `BottomNavigationV2` כבר תומך ב-Badge (משתמש בו לצ'אט בלבד היום).

## מה נבנה

### 1. כרטיס "אפליקציות חדשות ממתינות לאישור" ב-HomeV2
קובץ חדש: `src/components/home-v2/HomePendingApps.tsx` — באותו סגנון של `HomePendingTimeRequests`:
- שואב מ-`installed_apps` את האפליקציות של ילדי המשפחה שאין להן רשומה תואמת ב-`app_policies` (אלה ה-"ממתינות").
- מציג עד 5 אפליקציות, עם שם הילד, שם האפליקציה ומתי זוהתה (`last_seen_at`).
- שני כפתורים מהירים לכל שורה:
  - ✓ אישור → INSERT ל-`app_policies` עם `is_blocked = false`.
  - ✗ חסימה → INSERT ל-`app_policies` עם `is_blocked = true`.
- Realtime subscription על `installed_apps` ו-`app_policies` כדי לרענן אוטומטית.
- נקרא ב-`HomeV2.tsx` מתחת ל-`HomePendingTimeRequests`.

### 2. חיווי (Badge) בטאבים של BottomNavigationV2
- מוסיפים hook חדש `useHomeAttentionCounts` שמאחד ספירות מתוך נתוני המשפחה:
  - **בית**: סך־הכל פעולות ממתינות (אפליקציות חדשות + בקשות זמן + בעיות הרשאה + מנותקים).
  - **התראות**: `unacknowledgedAlerts` (כשמופעל WhatsApp).
  - **משימות**: `pendingChoreApprovals` של כל הילדים.
  - **צ'אט**: כבר קיים (לא נוגעים).
- ה-hook יעטף שאילתה קצרה (אותם מקורות שכבר ב-`HomeV2`) + Realtime על הטבלאות הרלוונטיות, וישמור cache קטן ב-React state ברמת ה-Layout/Nav.
- `BottomNavigationV2.tsx`: משתמש בערך לכל כפתור ומציג Badge קיים (אדום, מספר, "+99" אם גבוה) כאשר > 0.

### 3. בדיקת Push notifications
ה-flow קיים אבל המשתמש לא מקבל התראות. נוסיף שלבי אבחון בלי לשבור פונקציונליות:
- לבדוק שב-`push_subscriptions` יש רשומה פעילה להורה הזה (קריאה אבחנתית).
- לבדוק לוגים של edge function `send-push-notification` סביב הזמן של התקנת האפליקציה.
- לוודא ש-GUC `app.settings.service_role_key` מוגדר במסד — בלעדיו הטריגר רושם WARNING ומדלג על השליחה.
- אם חסר: נריץ migration קצרה שמגדירה את ה-GUC, או נחליף לקריאה דרך Edge Function נפרדת שלא תלויה ב-GUC.

הצעדים האלה הם אבחון/תיקון נקודתי שיוחלט עליו אחרי הבדיקה — לא כל המהלכים בהכרח דרושים.

## קבצים שייווצרו / יישונו
- חדש: `src/components/home-v2/HomePendingApps.tsx`
- חדש: `src/hooks/useNavBadgeCounts.ts`
- שינוי: `src/pages/HomeV2.tsx` (הוספת הכרטיס)
- שינוי: `src/components/BottomNavigationV2.tsx` (Badges לכל הטאבים הרלוונטיים)
- אופציונלי: migration קצרה לתיקון GUC של service_role_key אם יתברר שחסר

## מה לא נוגע
- אין שינוי ב-Android client.
- אין שינוי בלוגיקת ה-pending עצמה (כבר עובדת מקצה לקצה).
- אין שינוי ב-V1 / Dashboard הישן.

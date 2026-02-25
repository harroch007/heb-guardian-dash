

## תיקון: רענון רשימת משתמשים אחרי מחיקה

### הבעיה
המחיקה עצמה **עובדת** — ה-Edge Function מחק בהצלחה את המשתמש "עידן סאסי" מהדאטאבייס (מאומת בלוגים ובשאילתה). הבעיה היא שה-UI לא מרענן את רשימת המשתמשים אחרי המחיקה.

### שרשרת הקריאות הנוכחית
```text
Admin.tsx (fetchUsers → users state)
  └─ AdminUsersHub (users prop, onClose = setSelectedUser(null))
       └─ AdminCustomerProfile (onClose called after delete)
```

אחרי מחיקה, `onClose()` רק סוגר את הפרופיל — אין שום קריאה ל-`fetchUsers()` מחדש.

### הפתרון
1. **Admin.tsx** — לחשוף את `fetchUsers` כ-prop `onRefreshUsers` ל-`AdminUsersHub`
2. **AdminUsersHub.tsx** — להעביר callback `onUserDeleted` ל-`AdminCustomerProfile`
3. **AdminCustomerProfile.tsx** — לקרוא ל-`onUserDeleted` אחרי מחיקה מוצלחת (לפני `onClose`)

### שינויים בקבצים

**`src/pages/Admin.tsx`**
- הוספת prop `onRefreshUsers={fetchUsers}` ל-`AdminUsersHub`

**`src/pages/admin/AdminUsersHub.tsx`**
- קבלת prop `onRefreshUsers`
- העברתו ל-`AdminCustomerProfile` כ-`onUserDeleted`
- כשהמשתמש נמחק: סגירת הפרופיל + קריאה לרענון

**`src/pages/admin/AdminCustomerProfile.tsx`**
- קבלת prop `onUserDeleted`
- קריאה אליו אחרי מחיקה מוצלחת (שורה 348-350)

### פרטים טכניים
- 3 קבצים משתנים, ללא שינוי בדאטאבייס
- אחרי מחיקה מוצלחת, `fetchUsers()` נקרא מחדש ומביא את הרשימה המעודכנת
- המשתמש שנמחק ייעלם מהטבלה מיד


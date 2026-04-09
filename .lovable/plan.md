

## שורש הבעיה

ב-`FamilyV2.tsx` שורה 280 יש early return:
```
if (loading || roleLoading) {
  return <Loader2 spinner />;
}
```

כש-`onChildAdded` קורא ל-`fetchData()`, הפונקציה מפעילה `setLoading(true)` → הקומפוננטה מחזירה ספינר בלבד → `AddChildModal` נמחק מה-DOM → כשהטעינה נגמרת, המודאל נטען מחדש עם state ריק → חוזרים לטופס במקום למסך חיבור.

## תוכנית תיקון

### 1. FamilyV2.tsx — לא להסתיר את המודאל בזמן טעינה

שינוי ה-early return כך שאם המודאל פתוח (`addChildOpen === true`), לא נחזיר את הספינר. במקום זאת, נעביר את הספינר לתוך התוכן הראשי ונשאיר את `AddChildModal` תמיד מרונדר:

```text
// במקום:
if (loading || roleLoading) {
  return <spinner />;
}

// נשנה ל:
// הספינר יוצג בתוך ה-layout הראשי, לא כ-early return
// AddChildModal תמיד ירונדר בתחתית
```

### 2. AddChildModal.tsx — לקרוא ל-onChildAdded רק אחרי שהמעבר לשלב pairing הושלם

להעביר את הקריאה ל-`onChildAdded` ל-`useEffect` שמופעל כש-`step` משתנה ל-`"pairing"`, כדי להבטיח שה-state עודכן לפני שמתחילים את ה-refetch:

```text
// במקום לקרוא onChildAdded() ישירות ב-handleSubmit
// נקרא לו ב-useEffect שמאזין ל-step === "pairing"
```

### 3. QRCodeDisplay — תיקון ה-realtime listener

ה-realtime listener ב-`QRCodeDisplay` מאזין לכל שינוי (`event: '*'`) בטבלת `devices`, כולל שינויים שאינם חיבור חדש. צריך לסנן רק אירועי `INSERT` כדי למנוע זיהוי שגוי של חיבור.

### 4. בעיית "אין נתוני בריאות"

זו בעיה ידועה — ה-heartbeat reporting באפליקציית האנדרואיד (v1.8) לא פעיל עדיין. הפונקציה `sendDeviceHealthStatus` ריקה. זה לא קשור לדשבורד ההורה.

---

### פרטים טכניים

**קבצים שישתנו:**
- `src/pages/FamilyV2.tsx` — שינוי ה-early return כך שלא ימחק את ה-`AddChildModal` בזמן refetch
- `src/components/AddChildModal.tsx` — העברת `onChildAdded()` ל-effect שמופעל אחרי מעבר ל-pairing

**הבעיה המרכזית:** `setLoading(true)` ב-`fetchData` → early return בשורה 280 → unmount של AddChildModal → איבוד state


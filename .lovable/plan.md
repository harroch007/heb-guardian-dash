

## תוכנית: הסתרת מכשירים ישנים/כפולים

### הבעיה
כשיש לילד שני מכשירים (למשל אחרי החלפת טלפון), המכשיר הישן עדיין מוצג — בלי דגם, עם נתונים ישנים. צריך להציג רק את המכשיר העדכני ביותר, או לסנן מכשירים לא פעילים.

### הפתרון
ב-`AdminCustomerProfile.tsx`, בעת בניית `childrenWithDevices` (שורות 241-257), מיין את המכשירים לפי `last_seen` (יורד) ולקח רק את הראשון — **או** סנן מכשירים שלא נראו מעל 7 ימים כשיש מכשיר חדש יותר.

### שינוי אחד

**קובץ:** `src/pages/admin/AdminCustomerProfile.tsx` (~שורה 243)

בפילטור המכשירים לכל ילד, מיין לפי `last_seen` יורד ולקח רק את המכשיר הראשון (העדכני ביותר):

```typescript
devices: (devices || [])
  .filter((d: any) => d.child_id === child.id)
  .sort((a: any, b: any) => {
    const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
    const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;
    return bTime - aTime;
  })
  .slice(0, 1)  // keep only the most recent device
  .map((d: any) => ({ ... }))
```

זה מסיר את המכשיר הישן מהתצוגה ומשאיר רק את הפעיל ביותר.


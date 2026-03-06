

## תיקון שגיאת Build ב-AdminCustomerProfile.tsx

### הבעיה
הפונקציה `handleRequestHeartbeat` הוכנסה בטעות באמצע הפונקציה `logActivity`, מה שגרם לפיצול שלה. שורות 332-340 הן ה"זנב" של `logActivity` בלי ההגדרה שלה (header).

### התיקון
הוספת חזרה את ה-header של `logActivity` לפני שורה 332:

```typescript
  const logActivity = async (actionType: string, details: Record<string, any> = {}) => {
    const { data: { user: adminUser } } = await adminSupabase.auth.getUser();
    ...
  };
```

כלומר — שורה 331 (שורה ריקה) צריכה להיות מוחלפת ב:

```typescript
  const logActivity = async (actionType: string, details: Record<string, any> = {}) => {
```

שינוי של שורה אחת בלבד שמחזיר את הגדרת הפונקציה למקומה.


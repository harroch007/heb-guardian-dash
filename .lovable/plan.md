

## תוכנית: זיהוי חכם של הרשאות + הצגת דגם מכשיר

### שינויים ב-`AdminCustomerProfile.tsx`

**1. עדכון ממשק `ChildDetail`** — הוספת שדה `healthSignals` לכל מכשיר:
```typescript
devices: { 
  device_id: string; 
  // ...existing fields...
  appUsage7d: number;   // כמות רשומות app_usage ב-7 ימים
  realAlerts7d: number; // כמות alerts (לא PERMISSION_MISSING) ב-7 ימים
}[];
```

**2. עדכון `fetchCustomerData`** — שאילתות נוספות לכל מכשיר:
- ספירת `app_usage` ב-7 ימים אחרונים per device_id
- ספירת `alerts` (category != PERMISSION_MISSING) ב-7 ימים אחרונים per device_id

**3. עדכון לוגיקת הצגת הרשאות** (שורות 711-720):
- `permissionAlerts.length > 0` → באדג' כתום "הרשאות חסרות"
- `appUsage7d > 0 && realAlerts7d === 0` → באדג' כתום "חשד להרשאות חסרות — יש שימוש באפליקציות אבל אין התראות"
- `appUsage7d > 0 && realAlerts7d > 0` → באדג' ירוק "הרשאות תקינות"
- `appUsage7d === 0` → לא מציג (אין מספיק מידע)

**4. עדכון הצגת דגם מכשיר** (שורה 695):
- כשאין `device_model`/`device_manufacturer` → מציג "📱 דגם לא דווח" במקום `מכשיר 8c34d1f...`


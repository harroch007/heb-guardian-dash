

## תוכנית: הוספת הרשאת Overlay למפת ההרשאות בדשבורד

### הבעיה
המכשיר מדווח 6 הרשאות אבל חסרה הרשאה שביעית — `canDrawOverlays` (הצגה מעל אפליקציות). הרשאה זו קריטית לאכיפת חסימת מסך.

### מה צריך לקרות באנדרואיד (לא בצד שלנו)
ה-APK צריך להוסיף `canDrawOverlays: true/false` לאובייקט ה-permissions שנשלח ב-`report_device_heartbeat`.

### מה נשנה בצד הווב (2 קבצים)

**`src/components/controls/DeviceHealthBanner.tsx`** — הוספת שורה ל-`PERMISSION_LABELS`:
```
canDrawOverlays: "הצגה מעל אפליקציות",
```

**`src/components/child-dashboard/ProblemBanner.tsx`** — אותו הדבר:
```
canDrawOverlays: "הצגה מעל אפליקציות",
```

כך ברגע שה-APK יתחיל לדווח את ההרשאה, הדשבורד יציג אותה אוטומטית (ואם היא חסרה — יציג אזהרה).


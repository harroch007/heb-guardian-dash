
## מטרה
להפוך את /admin ממוקד-AI/ווטסאפ לדשבורד ניהול שמשקף את קיפי החדש (בקרת הורים: משימות, תגמולים, זמן מסך, גבולות גזרה, מכשירים).

## מבנה טאבים חדש (4 במקום 7)

```
[סקירה כללית] [משתמשים] [תפעול בקרת הורים] [מרכז עזרה]
```

### 1. סקירה כללית (AdminOverview – שכתוב)
**להסיר:** alertsByVerdict, alertsTrend (safe/review/notify/notified), messagesScannedToday, criticalAlertsToday, alertsAnalyzedToday, systemAlertsToday, feedbackTrend, feedbackEngagementRate, freeChildren/premiumChildren, queue widgets.

**להשאיר/לשנות:**
- `totalParents`, `totalWaitlist`, `totalDevices`, `activeUsersToday`, `activeChildrenToday`, `activeParentsThisWeek`
- Funnel: Waitlist → נרשמו → הוסיפו ילד → חיברו מכשיר → פעילים היום

**להוסיף (מטריקות בקרת הורים, לא-AI):**
- משימות: סה"כ פעילות, הושלמו היום, ממתינות לאישור הורה
- בנק תגמולים: סה"כ דקות זמינות במערכת, פדיונות היום
- זמן מסך: ממוצע דקות שימוש היום לכל ילד פעיל, מספר בקשות הארכת זמן ממתינות
- מכשירים: כמה online (≤15 דק'), today, offline (>24h), בלי מכשיר
- מיקומים: כמה משפחות הגדירו ≥1 child_place

### 2. משתמשים (AdminUsersHub – לשמר)
- תתי-טאבים: משתמשים, דורשים טיפול, רשימת המתנה
- **להסיר:** טאב "פרומו קודים" (AdminPromoCodes)
- AdminCustomerProfile נשמר; להסיר ממנו כל סקציית AI/ווטסאפ אם קיימת

### 3. תפעול בקרת הורים (חדש – AdminParentalOps)
4 תתי-טאבים:
- **משימות ובנק תגמולים** – טבלאות chores, chore_completions, reward_transactions, reward_bank; פילוח לפי משפחה; ממתינות לאישור
- **זמן מסך וזמן בונוס** – שימוש יומי ממוצע, time_extension_requests פתוחות, bonus_time_grants פעילים, פדיונות מבנק
- **גבולות גזרה ומיקומים** – child_places מוגדרים, אירועי enter/exit אחרונים, מפת מיקומים (אופציונלי)
- **מכשירים וחיבוריות** – טבלת מכשירים: סוללה, last_seen, סטטוס, פקודות תלויות, אפשרות לסנן offline >24h

### 4. מרכז עזרה (AdminHelpCenter – לשמר כמות שהוא)

## קבצים להסיר מהראוטינג (לא מהדיסק בשלב זה)
- `AdminAlertsAndAI.tsx` – מוסר מ-Tabs
- `AdminAIAnalyst.tsx` – מוסר
- `AdminAlertQA.tsx` – מוסר
- `AdminQueue.tsx` – מוסר
- `AdminPromoCodes.tsx` – מוסר מ-AdminUsersHub
- `AdminTraining.tsx`, `AdminInsightStats.tsx`, `AdminModelComparison.tsx`, `AdminFeedback.tsx` – אם לא בשימוש מאף מקום אחר

הקבצים יישארו על הדיסק לגיבוי; ניתן למחוק בהמשך.

## קבצים חדשים
- `src/pages/admin/AdminParentalOps.tsx` – טאב הראשי עם 4 תתי-טאבים
- `src/pages/admin/parental-ops/ChoresAndRewardsPanel.tsx`
- `src/pages/admin/parental-ops/ScreenTimePanel.tsx`
- `src/pages/admin/parental-ops/PlacesPanel.tsx`
- `src/pages/admin/parental-ops/DevicesPanel.tsx`

## עדכון Admin.tsx
- צמצום ל-4 TabsTriggers, החלפת אייקונים: LayoutDashboard, Users, SlidersHorizontal, HelpCircle
- מחיקת state מיותר (trainingStats, trainingRecords, queue auto-refresh)
- מחיקת fetchTrainingStats, getAgeGroup, getRiskLevel, getClassificationLabel, VERDICT_COLORS
- ב-fetchOverviewStats: למחוק כל החישובים של verdict/feedback/queue ולהוסיף שאילתות חדשות (chores aggregated, time_extension_requests count, child_places count, devices status breakdown)

## עיצוב/UX
- שמירה על dir="rtl", הכותרת "דשבורד ניהול | מרכז שליטה למנכ"ל"
- כל המטריקות בעברית, עיצוב כרטיסים זהה לקיים (bg-card border-border/50)

## הערות חשובות
- שום שינוי במסד הנתונים לא נדרש – רק שאילתות SELECT חדשות מטבלאות קיימות.
- AdminCustomerProfile, AdminAttentionReport, AdminWaitlist, AdminUsers נשארים ועובדים.
- אין שינוי במידע של משתמשים – רק החלפת תצוגה.

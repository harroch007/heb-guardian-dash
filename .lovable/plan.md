

# סנכרון נתוני התראות בזמן אמת בדשבורד

## הבעיה
הדשבורד מציג נתונים מ-`parent_home_snapshot` ומאחסן אותם ב-cache לפי `last_seen` של המכשיר. כשמגיעה התראה חדשה (נוטיפיקציה), ה-`last_seen` לא משתנה — ולכן הדשבורד ממשיך להציג את הנתונים הישנים (0 התראות) עד שהמכשיר שולח עדכון חדש.

## פתרון
הוספת Supabase Realtime subscription על טבלת `alerts` בדשבורד. כשהתראה חדשה מעובדת (`is_processed = true`) לילד הנבחר — הדשבורד ירענן את הנתונים אוטומטית (force refresh שעוקף את ה-cache).

## שינויים טכניים

### קובץ: `src/pages/Dashboard.tsx`

1. **הוספת Realtime subscription** — בתוך `useEffect` שמאזין לשינויים בטבלת `alerts`:
   - מסנן לפי `child_id` של הילד הנבחר
   - מגיב על `INSERT` ו-`UPDATE` (כשההתראה עוברת עיבוד ומתעדכנת)
   - כשמתקבל שינוי — קורא ל-`fetchSnapshot(false, true)` (force refresh, ללא loading state)
   - מנקה את ה-subscription כשמשתנה הילד או כשהקומפוננטה מתפרקת

2. **Invalidation של cache** — ה-force refresh כבר קיים (`forceRefresh = true` בשורה 270), כך שצריך רק לקרוא לו

### קוד חדש (בערך):
```typescript
// Realtime: refresh when new alerts arrive for selected child
useEffect(() => {
  if (!selectedChildId) return;
  
  const channel = supabase
    .channel(`dashboard-alerts-${selectedChildId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'alerts',
        filter: `child_id=eq.${selectedChildId}`,
      },
      (payload) => {
        const newRecord = payload.new as any;
        // Only refresh when alert is processed (has AI results)
        if (newRecord?.is_processed) {
          console.log("[Dashboard] Realtime: new processed alert, refreshing...");
          fetchSnapshot(false, true); // force refresh, no loading spinner
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [selectedChildId, fetchSnapshot]);
```

## מה זה פותר
- כשהתראה חדשה נשלחת להורה → הדשבורד מתעדכן תוך שניות
- `notify_effective_today` ו-`alerts_sent` יציגו ערכים נכונים
- לא צריך לחכות לעדכון `last_seen` מהמכשיר
- ה-cache מתעדכן אוטומטית עם הנתונים החדשים

## סיכום
- קובץ אחד: `src/pages/Dashboard.tsx`
- שינוי מינימלי: הוספת useEffect אחד עם Realtime subscription
- לא משפיע על ה-cache logic הקיים — רק מוסיף trigger נוסף לרענון


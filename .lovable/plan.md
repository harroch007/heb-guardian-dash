

# פיצול זרימת חיבור מכשיר לשני שלבים

## סיכום הדרישה
פיצול `QRCodeDisplay` ל-2 שלבים:
1. **שלב 1 — הורדת האפליקציה**: QR שמוביל לחנות Google Play + כפתור "שלב הבא"
2. **שלב 2 — חיבור המכשיר**: הצגת קוד ידני + אימייל ההורה. ההורה מזין את האימייל + הקוד באפליקציה שבמכשיר הילד. כשהמכשיר מתחבר — realtime redirect לדשבורד

## שינויים

### 1. `src/components/QRCodeDisplay.tsx` — שכתוב מלא

**Props חדש**: הוספת `parentEmail: string` כדי להציג את האימייל בשלב 2

**State חדש**: `step` (1 או 2)

**שלב 1:**
- QR Code שמפנה ל: `https://play.google.com/store/apps/details?id=com.kippy.safety.core`
- טקסט: "סרקו את הקוד עם מכשיר הילד להורדת אפליקציית KippyAI"
- כפתור "שלב הבא" שמעביר ל-step 2

**שלב 2:**
- הצגת אימייל ההורה (`parentEmail`)
- הצגת הקוד הידני (pairing code) + כפתור העתקה
- הסבר: "הזינו את האימייל והקוד במסך ההתחברות באפליקציה"
- Realtime subscription על טבלת `devices` — מאזין לשינוי `child_id` שתואם ל-`childId`. כשמכשיר מתחבר → toast הצלחה + `onFinish()` (שמבצע redirect)

**Realtime listener:**
```typescript
const channel = supabase
  .channel(`device-pair-${childId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'devices',
    filter: `child_id=eq.${childId}`
  }, () => {
    toast({ title: 'המכשיר חובר בהצלחה!' });
    onFinish();
  })
  .subscribe();
```

**כפתור "סגור וחבר מאוחר יותר"** — נשאר בשני השלבים

### 2. `src/components/AddChildModal.tsx` — עדכון props
שורה 278: הוספת `parentEmail={user?.email || ''}` ל-`QRCodeDisplay`

### 3. `src/pages/ChildDashboard.tsx` — עדכון props
שורה 650: הוספת `parentEmail={user?.email || ''}` ל-`QRCodeDisplay`

## סיכום טכני
- 3 קבצים: `QRCodeDisplay.tsx`, `AddChildModal.tsx`, `ChildDashboard.tsx`
- QR בשלב 1 מפנה לחנות Play (לא לקוד pairing)
- שלב 2 מציג אימייל + קוד ידני
- Realtime subscription מזהה חיבור מכשיר ועושה redirect
- `onFinish` callback אחראי על הניווט (כבר קיים בקוד הקורא)


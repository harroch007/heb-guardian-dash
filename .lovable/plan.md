

# תיקון שגיאת "לא ניתן לשמור משוב" - שתי בעיות

## הבעיות שנמצאו

**בעיה 1: parentId ריק** -- בקובץ `AlertCardStack.tsx` שורה 349, כשה-`parentId` עוד לא נטען (null), הוא מומר למחרוזת ריקה `''` שנשלחת כ-UUID לא תקין. זו הסיבה לשגיאה `invalid input syntax for type uuid: ""`.

**בעיה 2: RLS Policies -- RESTRICTIVE** -- כל ה-policies על `alert_feedback` עדיין RESTRICTIVE. גם אחרי תיקון ה-parentId, הכתיבה תיחסם כי אין אף policy מסוג PERMISSIVE.

## התיקונים

### 1. תיקון קוד: AlertFeedback.tsx

הוספת בדיקה בתחילת `handleFeedback` -- אם `parentId` ריק, מציגים הודעת שגיאה ברורה ולא שולחים בקשה:

```typescript
const handleFeedback = async (type: FeedbackType) => {
  if (loading) return;
  if (!parentId) {
    toast({ title: "שגיאה", description: "יש להתחבר מחדש", variant: "destructive" });
    return;
  }
  // ... rest of logic
};
```

### 2. תיקון קוד: AlertCardStack.tsx שורה 349

שינוי מ-`parentId={parentId || ''}` ל-`parentId={parentId ?? ''}` (למעשה לא ישנה, אבל ה-guard ב-AlertFeedback יתפוס את זה).

### 3. מיגרציית DB: תיקון RLS policies

מחיקת כל ה-policies הקיימות על `alert_feedback` ויצירתן מחדש כ-PERMISSIVE:

```sql
DROP POLICY IF EXISTS "Parents can insert own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Parents can select own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Parents can update own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON alert_feedback;

CREATE POLICY "Parents can insert own feedback" ON alert_feedback
  FOR INSERT TO authenticated WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can select own feedback" ON alert_feedback
  FOR SELECT TO authenticated USING (parent_id = auth.uid());

CREATE POLICY "Parents can update own feedback" ON alert_feedback
  FOR UPDATE TO authenticated USING (parent_id = auth.uid());

CREATE POLICY "Admins can view all feedback" ON alert_feedback
  FOR SELECT TO authenticated USING (is_admin());
```

## סיכום

| בעיה | קובץ | תיקון |
|------|------|-------|
| parentId ריק | AlertFeedback.tsx | Guard בתחילת handleFeedback |
| parentId fallback | AlertCardStack.tsx שורה 349 | לא חייב לשנות, ה-guard מגן |
| RLS חוסם הכל | DB migration | החלפת RESTRICTIVE ב-PERMISSIVE |


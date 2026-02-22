

# משוב = אישור אוטומטי של התראה

## הרעיון
כשהורה לוחץ על "רלוונטי" או "לא רלוונטי", זה אומר שהוא קרא את ההתראה. לכן, לחיצה על אחד מכפתורי המשוב תפעיל גם את פעולת "הבנתי, תודה" (acknowledge) באופן אוטומטי.

## השינוי

### AlertCardStack.tsx
- העברת ה-callback של `onAcknowledge` לתוך `AlertFeedback` דרך prop חדש
- או: שימוש ב-`onFeedbackChange` הקיים כדי להפעיל acknowledge אחרי שהמשוב נשמר בהצלחה

### AlertFeedback.tsx
- הוספת prop חדש: `onAutoAcknowledge?: () => void`
- אחרי שמירת משוב מוצלחת (אחרי ה-upsert), קריאה ל-`onAutoAcknowledge()`

### פירוט טכני

**AlertFeedback.tsx** -- הוספת prop והפעלתו:
```typescript
interface AlertFeedbackProps {
  alertId: number;
  parentId: string;
  existingFeedback?: FeedbackType | null;
  onFeedbackChange?: (alertId: number, feedback: FeedbackType) => void;
  onAutoAcknowledge?: () => void;  // חדש
}
```

בתוך `handleFeedback`, אחרי upsert מוצלח:
```typescript
onFeedbackChange?.(alertId, type);
onAutoAcknowledge?.();  // שורה חדשה
```

**AlertCardStack.tsx** -- העברת prop:
```tsx
<AlertFeedback
  alertId={currentAlert.id}
  parentId={parentId ?? ''}
  existingFeedback={feedbackMap?.[currentAlert.id] ?? null}
  onFeedbackChange={onFeedbackChange}
  onAutoAcknowledge={handleAcknowledge}  // חדש
/>
```

כך הלחיצה על משוב תפעיל את אותו `handleAcknowledge` שמפעיל אנימציית יציאה ומסמן את ההתראה כטופלת.


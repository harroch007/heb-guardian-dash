

# תיקון מספר WhatsApp בדף Checkout

## הבעיה
בקובץ `src/pages/Checkout.tsx` (שורה 16) מוגדר מספר WhatsApp שונה מכל שאר האפליקציה:

- **Checkout:** `972547836498` (054-783-6498)
- **כל השאר:** `972548383340` (054-838-3340)

## התיקון
שינוי שורה אחת ב-`src/pages/Checkout.tsx`:

```
// לפני:
const WHATSAPP_LINK = "https://wa.me/972547836498?text=...";

// אחרי:
const WHATSAPP_LINK = "https://wa.me/972548383340?text=...";
```

## פירוט טכני
- קובץ אחד: `src/pages/Checkout.tsx`
- שינוי בשורה 16 בלבד — החלפת המספר בלינק
- ההודעה הקבועה (`text=...`) נשארת כמו שהיא


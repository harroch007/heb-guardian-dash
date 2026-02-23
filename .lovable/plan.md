

# מודל תשלום משפחתי — שדרוג כל הילדים בבת אחת

## סיכום
במקום לשדרג כל ילד בנפרד, ההורה ישדרג את כל המשפחה בפעולה אחת. המחיר ייקבע לפי מספר הילדים הרשומים, וקוד קופון אחד יחול על כל המשפחה.

## תמחור
| ילדים | מחיר חודשי |
|-------|-----------|
| 1     | 19 ש"ח    |
| 2     | 30 ש"ח    |
| 3+    | 40 ש"ח    |

## מה ישתנה

### 1. עמוד Checkout (`src/pages/Checkout.tsx`)
- הסרת התלות ב-`childId` מה-URL — במקום זה, שליפת כל הילדים של ההורה מ-Supabase
- הצגת מחיר דינמי לפי מספר הילדים (1 = 19, 2 = 30, 3+ = 40)
- הצגת שמות הילדים שישודרגו
- בשדרוג עם קוד קופון — כל הילדים מקבלים `subscription_tier = 'premium'` בבת אחת
- קוד קופון אחד לכל המשפחה

### 2. כרטיס שדרוג (`src/components/PremiumUpgradeCard.tsx`)
- הסרת `childId` מה-props — השדרוג תמיד ברמת משפחה
- עדכון הטקסט ל-"שדרג את כל המשפחה"

### 3. מודל השדרוג (`src/components/UpgradeModal.tsx`)
- הסרת `childId` — ה-link ל-checkout בלי childId
- עדכון הטקסט בהתאם

### 4. דשבורד (`src/pages/Dashboard.tsx`)
- `PremiumUpgradeCard` יופיע אם לפחות ילד אחד הוא free (לא צריך childId ספציפי)

### 5. `useSubscription` hook (`src/hooks/useSubscription.ts`)
- הוספת variant חדש: `useSubscription()` בלי childId — בודק אם **כל** הילדים premium
- או: `useFamilySubscription()` hook חדש שמחזיר את הסטטוס המשפחתי

## זרימה חדשה
1. הורה לוחץ "שדרג" בדשבורד או בכרטיס ילד
2. מגיע לעמוד checkout שמציג: "שדרוג Premium לכל המשפחה"
3. רואה את שמות הילדים ואת המחיר לפי הכמות
4. מכניס קוד קופון (אופציונלי)
5. לוחץ "שדרג" — כל הילדים מתעדכנים ל-premium

## פרטים טכניים

### לוגיקת מחיר:
```text
function getFamilyPrice(childCount: number): number {
  if (childCount <= 1) return 19;
  if (childCount === 2) return 30;
  return 40; // 3+
}
```

### שדרוג כל הילדים:
```text
// במקום update לילד אחד:
const { error } = await supabase
  .from("children")
  .update({ subscription_tier: "premium", subscription_expires_at: expiresAt })
  .eq("parent_id", userId);
```

### שליפת ילדים ב-checkout:
```text
const { data: children } = await supabase
  .from("children")
  .select("id, name, subscription_tier")
  .eq("parent_id", userId);
```

### קבצים שישתנו:
- `src/pages/Checkout.tsx` — שינוי מרכזי (הסרת childId, הוספת לוגיקה משפחתית)
- `src/components/PremiumUpgradeCard.tsx` — הסרת childId מ-props
- `src/components/UpgradeModal.tsx` — הסרת childId מ-props ומה-link
- `src/hooks/useSubscription.ts` — תמיכה ברמת משפחה
- `src/pages/Dashboard.tsx` — עדכון הקריאה ל-PremiumUpgradeCard

### הערה על קוד קופון:
קוד קופון אחד מוחל על כל המשפחה. ההנחה חלה על המחיר המשפחתי (לא לכל ילד בנפרד). למשל: קוד `free_months: 3` נותן 3 חודשים חינם לכל המשפחה.

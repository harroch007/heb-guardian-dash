

# תיקון כפתורי תשלום - לוגואים וטקסט

## מה לא עובד
הלוגואים של Apple Pay ו-Google Pay הם SVG מורכבים שנראים רע בגודל קטן ולא קריאים. הם צריכים להיות בגודל דומה לאייקון כרטיס אשראי, עם טקסט באנגלית לצדם.

## מה ישתנה

### `src/pages/Checkout.tsx`
- הסרת הקומפוננטות `ApplePayLogo` ו-`GooglePayLogo` (ה-SVG המורכבים)
- החלפתם באייקונים פשוטים מ-lucide-react (`Smartphone` לגוגל, `Apple` מאייקון מותאם או טקסט) עם טקסט באנגלית
- כפתור Apple Pay: אייקון + "Apple Pay"
- כפתור Google Pay: אייקון + "Google Pay"
- כפתור כרטיס אשראי: נשאר כמו שהוא (אייקון CreditCard + "כרטיס אשראי")
- כל שלושת הכפתורים באותו סגנון אחיד

### מבנה כפתור חדש:
```text
[Arrow <-]                [Icon] Apple Pay
[Arrow <-]               [Icon] Google Pay
[Arrow <-]        [Icon] כרטיס אשראי
```

שלושתם בגודל זהה, אייקונים בגודל `w-6 h-6`, טקסט `text-base`.

### פרטים טכניים
- lucide-react אין לו אייקוני Apple/Google ממותגים, אז נשתמש ב-`Wallet` עבור Apple Pay ו-`Smartphone` עבור Google Pay (או שניהם `CreditCard` variants)
- חלופה: SVG מינימלי רק של האייקון (תפוח / G) בגודל 24x24
- הטקסט "Apple Pay" ו-"Google Pay" באנגלית, dir="ltr" על הטקסט


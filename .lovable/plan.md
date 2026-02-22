

# מסך טעינה מעוצב לדשבורד

## מה ישתנה

בקובץ `src/pages/Dashboard.tsx`, המצב הנוכחי של טעינה (שורות 493-498) מציג בלוקים אפורים עם אנימציית pulse. נחליף את זה במסך טעינה יפה עם אנימציה ומסר בעברית.

## העיצוב

מכיוון שאין ספריית Lottie מותקנת בפרויקט, נשתמש ב-**framer-motion** (כבר מותקן) ליצירת אנימציה חלקה עם:

- אייקון מגן (Shield מ-lucide) עם אנימציית פעימה וסיבוב עדין
- טקסט ראשי: **"בודק את הנתונים..."**
- טקסט משני: **"עוד רגע הכל מוכן"**
- שלוש נקודות מקפצות כאפקט טעינה

## פירוט טכני

### קובץ: `src/pages/Dashboard.tsx`

החלפת בלוק ה-`snapshotLoading` (שורות 493-498) מ-pulse rectangles לקומפוננטת טעינה מעוצבת עם framer-motion:

```tsx
{snapshotLoading ? (
  <div className="flex flex-col items-center justify-center py-16 space-y-6">
    <motion.div
      animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <Shield className="h-16 w-16 text-primary" />
    </motion.div>
    <div className="text-center space-y-2">
      <p className="text-lg font-medium text-foreground">בודק את הנתונים...</p>
      <p className="text-sm text-muted-foreground">עוד רגע הכל מוכן</p>
    </div>
    {/* Three bouncing dots */}
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          className="w-2 h-2 rounded-full bg-primary"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  </div>
)
```

- ייבוא `motion` מ-`framer-motion` ו-`Shield` מ-`lucide-react` (כבר מותקנים)
- אנימציה חלקה שנותנת תחושה של "המערכת עובדת"
- RTL-friendly, מרכזי, ומתאים למובייל


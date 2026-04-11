

# תיקון: זיהוי מגבלות שחוצות חצות (שעת שינה)

## הבעיה
שעת השינה מוגדרת 20:00–07:00. הלוגיקה הנוכחית בודקת `currentTime >= start && currentTime <= end`, שנכשלת כשהחלון חוצה חצות.

## הפתרון
שינוי התנאי ב-`src/pages/HomeV2.tsx` שורה 204:

```
// לפני:
if (currentTime >= s.start_time && currentTime <= s.end_time)

// אחרי:
const crossesMidnight = s.start_time > s.end_time;
const inWindow = crossesMidnight
  ? (currentTime >= s.start_time || currentTime <= s.end_time)
  : (currentTime >= s.start_time && currentTime <= s.end_time);
if (inWindow)
```

כשהחלון חוצה חצות (start > end), צריך OR במקום AND — השעה הנוכחית צריכה להיות **אחרי** ההתחלה **או לפני** הסיום.

## היקף
קובץ אחד, שינוי של 4 שורות. אפס סיכון לשבור משהו אחר.


## הבעיה
הטאב "צ'אט" מופיע ב-`BottomNavigationV2` (מובייל בלבד) אך לא ב-`TopNavigationV2` (דסקטופ).

## הפתרון
הוספת אייטם "צ'אט" ל-`src/components/TopNavigationV2.tsx`:
- ייבוא `MessageCircle` מ-`lucide-react`.
- הוספת `{ title: "צ'אט", url: "/chat-v2", icon: MessageCircle }` ל-`allNavItems`, באותו סדר כמו במובייל (אחרי "משפחה", לפני "משימות").

ללא שינויים נוספים.

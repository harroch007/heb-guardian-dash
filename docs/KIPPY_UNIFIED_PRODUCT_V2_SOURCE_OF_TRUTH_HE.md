# Kippy V2 המאוחד — מקור אמת מוצרי

סטטוס: מאושר לביצוע מלא
בעל החלטה: מייסד Kippy
עודכן: 2026-08-01

## החלטת המוצר

Kippy V2 הוא מוצר אחד. גרסה מלאה חייבת לכלול יחד:

1. בקרת הורים;
2. ניטור בטיחות ב-WhatsApp;
3. אפליקציית Android אחת למכשיר הילד;
4. PWA אחד להורה;
5. Backend V2 אחד;
6. Control Tower אחד לאופרציה, לסוכנים ולעוזרת המנכ״ל.

אסור לשחרר גרסה שמכילה רק בקרת הורים או רק ניטור WhatsApp.

## אפליקציית הילד — AAB אחד

ה-AAB מכיל את כל יכולות הילד הפעילות:

- קליטת WhatsApp דרך Accessibility ו-Notification Listener;
- מחסנית מוצפנת ונפרדת לכל שיחה, FIFO ו-retention מוגבל;
- שני שערי בטיחות מקומיים;
- תמלול הודעות קוליות מקומי כאשר Gate Voice פעיל ומאומת;
- זמן מסך ומגבלה יומית;
- מדיניות אישור וחסימת אפליקציות;
- לוחות זמנים ומצב שבת;
- מיקום נוכחי, geofences ו-Locate;
- Ring ו-Lost Mode;
- heartbeat, סוללה, הרשאות, גרסה ובריאות שירותים;
- polling מאומת להגדרות ולפקודות V2.

לאחר pairing והשלמת הרשאות, ממשק הילד נשאר מינימלי ושקוף: מצב הגנה,
הסבר שהאפליקציה יכולה להיסגר, ותיקון הרשאות נדרש בלבד. אין בו מידע הורה,
feed אירועים, ניהול משפחה או פעולות ילד.

## ממשק ההורה

ה-PWA מספק לכל ילד אזור אחד שמאחד:

- חיבור, סטטוס ניטור, סוללה, דיווח אחרון ובריאות הרשאות;
- זמן מסך, מגבלות ותוספת זמן יזומה על ידי ההורה;
- אפליקציות מותקנות ומדיניות allow/block;
- לוחות זמנים ומצב שבת;
- מיקום, geofences, Locate, Ring ו-Lost Mode;
- אירועי בטיחות מאומתים והמלצות בטוחות להורה;
- תיקון pairing או הרשאות.

ה-PWA לעולם אינו קורא את מחסניות WhatsApp השגרתיות או היסטוריית שיחה
גולמית. הוא מקבל רק projection תפעולי ו-incidents שאושרו למדיניות הורה.

## יכולות שאינן בסקופ

- בקשת זמן נוסף מצד הילד;
- משימות, פרסים, בנק פרסים, streaks או תחרות;
- צ׳אט פנימי בין הורה לילד והזמנות חברתיות;
- ניטור Telegram, TikTok, Instagram או פלטפורמות נוספות;
- שינוי מיתוג, חבילות או תמחור לפני השלמת האינטגרציה.

## Backend V2

מקור האמת היחיד הוא חוזי V2 עבור:

- משפחה, guardian, ילד, מכשיר ו-pairing;
- הגדרות בקרת הורים וגרסאותיהן;
- פקודות מכשיר מאושרות, idempotency ותוצאות;
- device health ו-projections להורה;
- incidents, expert analysis, policy ו-delivery;
- Web Push;
- staff, RBAC/AAL2, cases, agents ו-audit.

אין למסלול פעיל לקרוא או לכתוב טבלאות/RPC של V1. קוד ישן נשמר זמנית רק
כ-donor עד שהחלופה המאוחדת עוברת QA.

## Control Tower וסוכנים

ה-Control Tower החדש הוא ממשק האופרציה היחיד. כל סוכן מקבל זהות והרשאות
מוגבלות לפי תפקיד, ומתחבר לאותם contracts ו-projections של V2. סוכן אינו
מקבל service role חופשי ואינו מאשר לעצמו פעולה רגישה.

עוזרת המנכ״ל היא סוכנת פרטית ונפרדת מערוצי הלקוחות. היא מסכמת נתוני
אופרציה, מוצר, בטיחות, שירות, כספים ושחרורים; פותחת cases ומשימות; ויכולה
להפעיל תהליך Codex מבוקר ליצירת patch/PR. היא אינה משנה Production ישירות.
כל שינוי Codex מחייב worktree מבודד, בדיקות, release gate ואישור אנושי.

### Codex activation boundary

- The CEO assistant may create and approve an audited Codex task request; it
  never runs repository commands from the browser or a Supabase Edge Function.
- A trusted server-side Node.js runner on an authorized development host
  claims the request and starts or resumes a Codex SDK thread in an isolated
  worktree with workspace-write permissions only.
- The runner returns structured review, patch, validation and PR metadata to
  the Control Tower. Production deployment still requires the normal release
  gate and explicit human approval.
- Codex credentials and repository credentials stay in the trusted runner.
  Prompts contain operational evidence and task scope, not raw child-message
  content.

## מעבדת Android Studio

לפני Google Play חייב להיות build מסוג Lab/QA שמאפשר לעקוב, על נתוני בדיקה
מורשים בלבד, אחר השרשרת:

```text
WhatsApp observation
  -> canonical message
  -> conversation FIFO
  -> local gate 1
  -> local gate 2
  -> encrypted expert envelope / dry run
  -> policy decision
  -> parent alert
```

עבור קול המעבדה מציגה גם artifact, correlation, decode, transcript,
verification והכנסה לאותה שרשרת. Production אינו רושם תוכן גולמי ללוגים.

## סדר ביצוע ושער שחרור

1. הקפאת contracts וזהויות משותפות;
2. Backend V2 מאוחד;
3. Android ו-PWA מאוחדים;
4. Control Tower, סוכני האופרציה ועוזרת המנכ״ל;
5. Android Studio + מכשיר פיזי + browser QA;
6. Google Play Internal Testing;
7. רק לאחר מוצר מלא עובד: אופטימיזציה, מיתוג ופרסום.

שער האינטגרציה בודק פונקציונליות מלאה. אופטימיזציות שאינן חוסמות שימוש,
בטיחות, פרטיות או יציבות אינן מעכבות את יצירת המוצר המאוחד ב-Android Studio.

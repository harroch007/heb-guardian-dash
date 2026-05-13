# Lost Mode — נעילת מכשיר חירום (MVP, שכבות 1+2)

פיצ'ר "מכשיר אבוד" שמאפשר להורה לסמן את מכשיר הילד כנעול ולהציג עליו הודעת חיוג חזרה. מימוש בצד ה-Parent + Backend בלבד. שכבת ה-Overlay בפועל באנדרואיד תיבנה ע"י צוות האנדרואיד בעזרת החוזה שמוגדר כאן.

## Scope (MVP)

- Lost Mode בלבד — לא Anti-Theft. ההורה מודע שילד טכני יכול לעקוף.
- בחירת מספר חיוג ידנית בכל הפעלה (ברירת מחדל: ההורה הראשון).
- ללא Device Owner / Device Admin.

---

## 1. Database (migration)

### טבלה חדשה: `device_lock_state`

עמודות תוכן (לא כולל id/timestamps סטנדרטיים):
- `child_id` (uuid) — מי ננעל
- `is_locked` (boolean, default false)
- `locked_at` (timestamptz)
- `locked_by` (uuid → parents)
- `unlocked_at` (timestamptz, nullable)
- `contact_name` (text) — שם שמוצג בהודעת הנעילה
- `contact_phone` (text) — מספר לחיוג
- `message` (text) — הודעה אופציונלית להורה ("הטלפון שלי אבד, אנא חייגו")
- אילוץ ייחודיות על `child_id` (רשומה אחת פעילה לכל ילד)

### RLS
- `SELECT` — `is_family_parent(child_id)` להורים, וגם `is_paired_device` / JWT-scoped לקריאה ע"י המכשיר עצמו (כדי שה-Android Service
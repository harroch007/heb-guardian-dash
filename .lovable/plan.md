## החלפת תווית "חינמי/פרימיום" באייקון מגדר/גיל בכרטיס משפחה (הגדרות)

בסקשן **משפחה** ב-`/settings-v2`, התווית הצדדית של כל ילד ("חינמי" / "פרימיום") הופכת ללא רלוונטית כי ויתרנו על ניתוח ווטסאפ. במקום זאת נציג אייקון של ילד/ילדה לפי המגדר עם צבע התלוי בקבוצת הגיל.

### שינויים

**1. `src/hooks/useFamilySubscription.ts`**
הרחבת השליפה והטיפוס של `ChildSubscriptionInfo` כך שיכלול את `gender` ו-`date_of_birth` (קיימים בטבלת `children` כ-NOT NULL):

```ts
interface ChildSubscriptionInfo {
  id: string;
  name: string;
  subscription_tier: string | null;
  gender: string | null;
  date_of_birth: string | null;
}
// .select("id, name, subscription_tier, gender, date_of_birth")
```

**2. קובץ עזר חדש: `src/lib/childAvatar.ts`**
פונקציות עזר משותפות לכל מקום שמציג ילד:

```ts
export function getAgeYears(dob: string | null): number | null { /* חישוב שנים */ }

export function getAgeBand(age: number | null): "young" | "tween" | "teen" | "unknown" {
  // young: <10, tween: 10-12, teen: 13+
}

// מחזיר Lucide icon component לפי מגדר
export function getChildIcon(gender: string | null) {
  // 'male' / 'בן' → Baby (קטן) או User (מבוגר); 'female' / 'בת' → אותו דבר אך עם צבע שונה
  // ברירת מחדל: User
}

// מחזיר Tailwind classes (text + bg) לפי מגדר וגיל
export function getChildAvatarClasses(gender, ageBand): { text: string; bg: string } {
  // בן: text-blue-500/sky-500/indigo-500 לפי גיל
  // בת: text-pink-500/rose-500/fuchsia-500 לפי גיל
  // לא ידוע: text-muted-foreground / bg-muted
}
```

ניצמד לטוקנים סמנטיים של Tailwind בסיסיים (sky/blue/indigo לבנים, pink/rose/fuchsia לבנות) — אלו צבעים סטנדרטיים של Tailwind ולא טוקנים מותאמים, אך הם משמשים גם במקומות אחרים בפרויקט (למשל ב-FamilyV2 שכבר מציג ילדים).

**3. `src/pages/SettingsV2.tsx`** — סקציית הילדים בתוך כרטיס "משפחה":
מחליפים את ה-`<span>` הצבעוני (חינמי/פרימיום) באייקון עגול ליד שם הילד:

```tsx
{children.map((child) => {
  const age = getAgeYears(child.date_of_birth);
  const band = getAgeBand(age);
  const Icon = getChildIcon(child.gender);
  const { text, bg } = getChildAvatarClasses(child.gender, band);
  return (
    <div key={child.id} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 text-sm">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${text}`} />
        </div>
        <span className="font-medium text-foreground">{child.name}</span>
      </div>
      {age !== null && (
        <span className="text-xs text-muted-foreground">גיל {age}</span>
      )}
    </div>
  );
})}
```

הצד הימני (השם) מקבל אייקון קטן צמוד; הצד השמאלי, במקום תווית "חינמי", מציג את הגיל בפועל ("גיל 12") אם יש תאריך לידה — מידע אמיתי בלבד; אם חסר — לא מציגים כלום.

### בלי שינוי

- אין שינוי ב-DB/RLS.
- אין שינוי בלוגיקת המינוי, המסכים האחרים, או בכרטיסים האחרים בהגדרות.
- אין שינוי בכרטיס "מינוי" (שם נשארים "פרימיום פעיל" וכו' — הוא ממילא מוסתר כש-`WHATSAPP_MONITORING_ENABLED=false`).

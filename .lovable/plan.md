## Notification Settings Simplification

### What Changes

Remove the two toggle sections ("התראה על אנשי קשר לא מוכרים" and "ניטור פעיל") from `/notification-settings`. Instead, the sensitivity level card will show a dynamic description below the three buttons that updates based on the selected level.

### Dynamic Descriptions per Level

- **רגיש** : "תקבל/י התראות על כל אירוע ברמת סיכון בינונית - מגביר את הסיכוי להתראות שווא, לא בטוח שזה השקט שאתם מחפשים"
- **מאוזן** : "תקבל/י התראות רק על אירועים משמעותיים - איזון בין שקט נפשי לבטיחות"
- **רק חמור** : "תקבל/י התראות רק על מצבים חמורים באמת - מינימום הפרעות, מקסימום רלוונטיות"

### Technical Details

**File**: `src/pages/NotificationSettings.tsx`

1. Add a `dynamicDescription` field to each item in `SENSITIVITY_LEVELS`
2. After the 3-button grid, render a `<p>` that shows `SENSITIVITY_LEVELS.find(l => l.key === selectedLevel).dynamicDescription` with a subtle style (`text-sm text-muted-foreground mt-4 text-center`)
3. Delete the two `<section>` blocks for "unknown contacts" and "monitoring enabled"
4. Remove unused imports: `UserX`, `Shield`, `Switch`
5. Remove `alert_on_unknown_contacts` and `monitoring_enabled` from `SettingsData` interface and `DEFAULTS` (keep only `alert_threshold`)

No database changes — the columns remain in `settings` but the UI simply won't modify them anymore.

### Layout Result

The page becomes a single clean card with: title → subtitle → 3 sensitivity buttons → dynamic explanation text. Nothing else.
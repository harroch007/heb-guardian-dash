

## Two Issues to Fix

### Issue 1: 409 Error When Saving Settings

**Root Cause**: The `settings` table has a partial unique index `uq_settings_child_no_device` defined as:
```sql
UNIQUE (COALESCE(parent_id, '00000000-...'), child_id) WHERE device_id IS NULL
```

The code uses `.upsert()` with `onConflict: "parent_id,child_id,device_id"`, but this doesn't match the actual partial unique index (which uses `COALESCE` and a `WHERE` clause). Supabase/PostgREST can't resolve the conflict via the named columns, so it attempts an INSERT and hits the unique constraint, returning 409.

**Fix**: Replace the `upsert` call with a two-step approach: first try `update` (matching `child_id` + `device_id IS NULL`), and if no row was updated (count = 0), fall back to `insert`.

**File**: `src/pages/NotificationSettings.tsx`, in the `updateSetting` function (around lines 88-100).

Change from:
```ts
const { error } = await supabase
  .from("settings")
  .upsert([{ child_id, parent_id, alert_threshold: value }],
    { onConflict: "parent_id,child_id,device_id" });
```

To:
```ts
// Try update first
const { error, count } = await supabase
  .from("settings")
  .update({ alert_threshold: value })
  .eq("child_id", selectedChildId)
  .is("device_id", null)
  .select();

// If no row existed, insert
if (!error && count === 0) {
  const { error: insertError } = await supabase
    .from("settings")
    .insert({ child_id: selectedChildId, parent_id: user.id, alert_threshold: value });
  if (insertError) { /* handle */ }
}
```

### Issue 2: Dynamic Description Text Placement

Move the `<p>` with `dynamicDescription` from **inside** the sensitivity card `<section>` to **below** it (outside the card border).

**File**: `src/pages/NotificationSettings.tsx` -- move the `<p className="text-sm text-muted-foreground mt-4 text-center">` line to after the closing `</section>` tag of the sensitivity card.

### No Database Changes Required


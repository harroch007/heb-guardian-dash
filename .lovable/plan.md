

# MVP-A Stability: Protection Status Banner + Alert Preview on Dashboard

## What Changes

Two focused additions to the parent Dashboard, using only existing data -- no new tables, edge functions, or API calls.

---

## Addition A: Protection Status Banner

A compact banner placed at the top of the Dashboard (between PushNotificationBanner and Card 1) showing whether monitoring is actively running.

### States

| Condition | Icon | Text | Color |
|-----------|------|------|-------|
| `last_seen` < 1 hour | ShieldCheck | ההגנה פעילה | Green |
| `last_seen` 1-24 hours | ShieldAlert | ההגנה פעילה (עיכוב) | Yellow |
| `last_seen` > 24 hours | ShieldOff | ההגנה לא פעילה | Red |
| No device (no snapshot) | ShieldOff | אין מכשיר מחובר | Gray/Muted |

Each state shows "עדכון אחרון: לפני X דקות/שעות" using the existing `formatLastSeen` function already in Dashboard.tsx.

### New File

`src/components/dashboard/ProtectionStatusBanner.tsx`
- Props: `lastSeen: string | null`, `hasDevice: boolean`
- Pure presentational component, ~60 lines
- Uses existing `lucide-react` Shield icons
- RTL layout with `dir="rtl"`

### Integration in Dashboard.tsx

Insert between `<PushNotificationBanner />` (line 448) and the child selector section (line 453):

```text
{snapshot !== null && (
  <ProtectionStatusBanner 
    lastSeen={snapshot.last_seen} 
    hasDevice={!!snapshot.device_id} 
  />
)}
```

When `snapshot` is null (no data yet), the banner is hidden -- the existing "אין נתונים להיום עדיין" card already handles that case.

---

## Addition B: Alert Preview Card on Dashboard

### What Parents See

The existing `AlertsCard` component (`src/components/dashboard/AlertsCard.tsx`) is already built and ready. It shows:
- Up to 3 recent alerts with risk-level color dots
- "הבנתי" button to acknowledge inline
- "הכל" link to navigate to the full Alerts page
- "הכל בסדר!" empty state when no open alerts

### What Needs to Change in AlertsCard

The current `AlertsCard` uses `parent_message` for display text, but per the filtering rules, actionable alerts have `parent_message = NULL` and use `ai_title` / `ai_summary` instead. The component needs a minor update:

- Change the Alert interface to include `ai_title` and `ai_summary`
- Display `ai_title || ai_summary || 'התראה חדשה'` instead of `parent_message`

### Integration in Dashboard.tsx

1. **Fetch open alerts** for the selected child alongside the existing snapshot fetch:

```text
const { data: alertsData } = await supabase
  .from('alerts')
  .select('id, ai_risk_score, ai_title, ai_summary, created_at, child_id')
  .eq('child_id', selectedChildId)
  .eq('is_processed', true)
  .is('acknowledged_at', null)
  .is('saved_at', null)
  .is('parent_message', null)
  .order('created_at', { ascending: false })
  .limit(5);
```

2. **Store in state**: `const [openAlerts, setOpenAlerts] = useState<Alert[]>([])`

3. **Render between Card 1 (Digital Activity) and the "Yesterday" button** (around line 536):

```text
<AlertsCard 
  alerts={openAlerts} 
  onAlertAcknowledged={() => fetchAlerts()} 
/>
```

4. **Refresh callback**: Re-fetch alerts when one is acknowledged.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/dashboard/ProtectionStatusBanner.tsx` | Create | New banner component (~60 lines) |
| `src/components/dashboard/AlertsCard.tsx` | Edit | Update Alert interface to use `ai_title`/`ai_summary` instead of `parent_message` for display |
| `src/pages/Dashboard.tsx` | Edit | Import banner + AlertsCard, add alert fetch query, render both components |

## What This Does NOT Change

- No new database tables or columns
- No new edge functions
- No changes to the Alerts page or alert generation
- No changes to notification system
- Alert grouping (anti-spam) is deferred to a follow-up task


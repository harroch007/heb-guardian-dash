

## Fix: Open Alerts Count Mismatch (239 vs 11)

### Problem

`FamilyV2` and `HomeV2` count alerts with a simplified query:
```
.is("acknowledged_at", null)
.eq("is_processed", true)
.eq("alert_type", "warning")
```

But `AlertsV2` (which shows 11) applies additional filters:
- `.is('saved_at', null)` — exclude saved alerts
- `.is('parent_message', null)` — exclude parent-messaged alerts
- `.in('ai_verdict', ['notify', 'review'])` — only actionable verdicts
- **Threshold filtering** — `ai_risk_score >= per-child threshold` (from `settings.alert_threshold`, default 65)
- **remind_at filtering** — exclude snoozed alerts

### Fix

Align the alert count queries in both `FamilyV2` and `HomeV2` to match AlertsV2's "new/open" filter:

**1. `src/pages/FamilyV2.tsx`** — Update the alerts query to add the missing filters, fetch `settings.alert_threshold` per child, and apply threshold + remind_at filtering in JS (same pattern as AlertsV2).

**2. `src/pages/HomeV2.tsx`** — Same fix for the alerts query used to compute `unacknowledgedAlerts` per child.

**3. `src/components/home-v2/AttentionSection.tsx`** — No changes needed (it just reads the count from props).

### No changes to
- Live screens
- AlertsV2 itself
- Backend / Supabase
- Any other V2 screens


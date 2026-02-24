

## Analysis: Why "12" Instead of "6"

The logic you described is **100% correct**. Here is exactly where it breaks:

### The Flow (As You Understand It — Correctly)
```text
147 messages scanned
 → 11 sent to AI analysis (stacks_sent_to_ai)
 → AI scores each one
 → Only those with risk_score >= threshold (65 "balanced") appear as "alerts sent"
 → You expect ~6 alerts sent (the ones that passed the threshold)
```

### The Bug: Duplicate Settings Row

The `parent_alerts_effective` view joins the `settings` table to get the parent's `alert_threshold`. But your child has **two** settings rows:

| id | parent_id | alert_threshold |
|----|-----------|----------------|
| 7818... | **NULL** | 70 |
| dc97... | fd0a1cc1... | 65 |

The `LEFT JOIN` matches both rows for every alert, so each alert appears **twice**. Result: 6 real alerts × 2 = **12**.

### Why the Duplicate Exists

A unique index (`uq_settings_child_no_device`) was added to prevent this, but it only applies when `parent_id IS NOT NULL`. The orphan row (parent_id = NULL, threshold = 70) slips through the constraint.

### The Fix (Two Parts)

**Part 1: Delete the orphan settings row**
Delete the row with `parent_id IS NULL` for this child. This immediately fixes the count from 12 to 6.

**Part 2: Fix the view to be resilient**
Replace the `LEFT JOIN settings` with `LEFT JOIN LATERAL ... LIMIT 1` so even if duplicates reappear in the future, each alert is counted only once. The LATERAL join picks the most specific settings row (prioritizing the one with `parent_id`).

**Part 3: Prevent future orphans**
Update the unique index to also cover `parent_id IS NULL` rows, or add a CHECK/trigger to prevent settings rows without a parent_id for a child.

### Summary

Your understanding is spot-on. The number should be ~6 (alerts where AI risk >= 65). The "12" is purely a database join bug — each alert is duplicated because of an orphan settings row.


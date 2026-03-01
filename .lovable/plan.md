

## Insert Test Alert for "קיפי1"

### SQL to execute via migration:

```sql
INSERT INTO alerts (
  child_id,
  device_id,
  source,
  content,
  processing_status,
  ai_status,
  created_at
) VALUES (
  '6233e88a-0212-4682-a350-442681e95a5f',
  '19f8fb504f674b31',
  'manual_debug',
  'DEBUG: קללה לצורך בדיקה, בבקשה להתעלם :)',
  'pending',
  'pending',
  now()
)
RETURNING id, created_at;
```

### What happens next:
1. The `enqueue_ai_analyze_on_alert_insert` trigger fires → adds job to `alert_events_queue`
2. pg_cron worker (every minute) picks it up → calls `analyze-alert`
3. After ~1-2 minutes, we check if `ai_status` updated to `'success'` or stayed `'pending'`

### Verification query (run after ~2 minutes):
```sql
SELECT id, ai_status, ai_verdict, is_processed, processing_status, ai_risk_score
FROM alerts WHERE source = 'manual_debug' ORDER BY created_at DESC LIMIT 1;
```


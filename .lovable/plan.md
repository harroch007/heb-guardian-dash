```

  SELECT id, status, requested_minutes, responded_at
  FROM time_extension_requests
  WHERE child_id = v_child_id
    AND status IN ('approved', 'rejected')
    AND responded_at IS NOT NULL
  ORDER BY responded_at DESC
  LIMIT 20
) tr;

v_settings := v_settings || jsonb_build_object('time_request_updates', v_time_request_updates);
```

#### Filtering rules

-   
Only terminal statuses (`approved`, `rejected`) — no pending rows  

-   
Only this child's requests (`child_id = v_child_id`)  

-   
No short time-window cutoff that could hide a real response after the device was offline — bounded only by newest-first limit  

-   
Limit 20 — bounded and still safe for offline catch-up  

-   
Ordered newest first  


#### Payload shape per item

```
{
  "request_id": "uuid",
  "status": "approved" | "rejected",
  "approved_minutes": 15 | null,
  "responded_at": "2026-04-05T12:00:00Z"
}
```

No `reason`, no `parent_id`, no internal fields exposed.

### Files Changed


| File              | Change                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| New migration SQL | `CREATE OR REPLACE FUNCTION get_device_settings` with added `time_request_updates` block |


Full function body is a copy of the latest version (from migration `20260405091536`) with one new variable declaration and one new block inserted before `RETURN`.

### Backward Compatibility

- **Additive only** — new key `time_request_updates` is ignored by existing Android builds  

- `bonus_time_grants` **path unchanged** — `effective_screen_time_limit_minutes` and `bonus_minutes_today` remain identical  

- **Parent dashboard unchanged** — `TimeRequestsCard` queries `time_extension_requests` directly, not through `get_device_settings`  

- **No schema changes** — no new tables, no new columns  

- **No RLS changes** — `get_device_settings` is `SECURITY DEFINER`, reads internally
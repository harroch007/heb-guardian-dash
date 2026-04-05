As CTO who built and knows the whole system, I am giving you one narrow task only.

Task:

Implement co-parent-aware parent push delivery on top of the existing notification system.

This phase is Supabase / Edge Functions only.

Do not touch Android.

Do not redesign the push architecture.

Do not widen scope into unrelated notification categories.

Goal:

Keep the current parent push system exactly as it works today, but extend recipient resolution so that push notifications are sent to:

- the owner parent

- and any accepted co-parent with `receive_alerts = true`

Use the existing system.

Do not create a parallel push system.

Critical scope rule:

Do not redesign `send-push-notification`.

Do not change `push_subscriptions` schema.

Do not change Lovable UI.

Do not touch child-side local notifications.

Do not add brand-new notification categories in this task.

Do not widen scope beyond the notification/event types that already send push today.

Current mapped system (already confirmed):

Push currently exists only for:

1. AI safety alerts via `analyze-alert`

2. Permission revocation alerts via `on_heartbeat_insert`

3. Periodic summaries via `generate-periodic-summary`

The single-parent assumption exists in exactly these 3 call sites, where recipient resolution currently uses only `children.parent_id`.

`send-push-notification` already works correctly for one recipient parent_id and sends to all their subscriptions.

It should remain unchanged unless you find a real blocker.

Your job:

Replace the single-parent recipient lookup with a shared recipient-resolution path that returns:

- owner parent_id

- plus accepted co_parent member_id rows where `receive_alerts = true`

Hard requirements:

1. First map the exact current recipient-resolution code before changing anything

Before writing code, confirm exactly:

- the current `children.parent_id` lookup in `analyze-alert`

- the current `children.parent_id` lookup in `on_heartbeat_insert`

- the current `children.parent_id` lookup in `generate-periodic-summary`

- that `send-push-notification` itself should remain unchanged

You must keep the current delivery engine intact and only change recipient resolution cleanly.

2. Build one shared recipient-resolution helper

Do not duplicate the same owner + co-parent lookup in 3 places if a narrow shared helper can be created safely.

Preferred approach:

Create one SQL helper function such as:

- `get_alert_recipients(p_child_id uuid)`

Expected behavior:

Return a set of recipient parent IDs consisting of:

- the owner `children.parent_id`)

- plus `family_members.member_id`

  where:

  - `owner_id = children.parent_id`

  - `status = 'accepted'`

  - `receive_alerts = true`

  - `member_id IS NOT NULL`

Important:

- owner always receives alerts

- co-parent receives alerts only if `receive_alerts = true`

- revoked/pending memberships must not receive anything

- duplicate recipient IDs must not be returned

If a SQL helper is clearly worse than a tiny shared TypeScript/PLPGSQL helper pattern, use the smallest clean solution.

But do not copy-paste recipient logic three times unless absolutely necessary.

3. Update exactly the 3 existing push call sites

Apply the new recipient resolution to:

- `analyze-alert`

- `on_heartbeat_insert`

- `generate-periodic-summary`

Required behavior:

- resolve all recipients for the child

- call `send-push-notification` once per recipient

- preserve the existing notification payload/content for each event type

- do not change the push message copy/content logic unless required for compatibility

4. Preserve existing push categories only

Do not add push for new categories in this task.

Do not add push for:

- time extension requests

- app installs

- positive alerts

- chores

- device realtime state

unless they already send push today

This task is only:

- existing push categories, now with co-parent-aware recipient resolution

5. Keep `send-push-notification` unchanged unless truly blocked

The mapped architecture already shows that `send-push-notification`:

- accepts `parent_id`

- fetches all subscriptions for that parent

- sends correctly

So the preferred implementation is:

- no changes to this function

- just call it once per resolved recipient

Only change it if you find a real blocker, and if so report it explicitly.

6. Dedup / safety

You must ensure one recipient is not resolved twice for the same event.

If owner and co-parent resolution somehow collide, dedup before delivery.

You do NOT need to build a global anti-duplicate notification engine in this task.

Just ensure recipient resolution itself is distinct and correct.

7. Backward compatibility

If a child has no co-parent:

- behavior must remain exactly the same as today

If a co-parent exists but `receive_alerts = false`:

- owner gets push

- co-parent gets nothing

If a co-parent exists and `receive_alerts = true`:

- both get push through the existing delivery path

Nothing about current owner-only behavior should regress.

8. What to return

I need exact implementation proof, not a summary.

Return:

1. Exact files changed

2. Exact helper created for recipient resolution

   - function name

   - location

   - exact logic / criteria

3. Exact 3 call sites updated

   - analyze-alert

   - on_heartbeat_insert

   - generate-periodic-summary

4. Exact proof that `send-push-notification` was unchanged, or exact reason if it had to change

5. Exact backward compatibility proof

6. Exact dedup behavior for recipient resolution

7. Migration / deploy status

8. Typecheck / function deploy result

9. Explicit report:

   - did it pass on the first try

   - if not, what failed first

   - exactly what you fixed

Final restriction:

Do not redesign the notification system.

Do not widen scope into new event categories.

Do only this co-parent-aware recipient resolution upgrade for the existing parent push paths, and report exactly what changed.
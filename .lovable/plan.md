As CTO who built and knows the whole system, I am giving you one narrow task only.

Task:

Add real parent push notifications for geofence alerts, on top of the existing notification system that already exists.

This phase is Supabase / Lovable only.

Do not touch Android.

Do not redesign the push architecture.

Do not widen scope into unrelated notification categories.

Goal:

When a geofence alert is already created by the current Android geofence system, the parent should receive an actual push notification through the same existing parent push system already used for:

- AI safety alerts

- permission revocation alerts

- periodic summaries

- time extension request created

- new app detected

And if an accepted co-parent exists with `receive_alerts = true`, they should receive it too.

Critical scope rule:

Do not redesign `send-push-notification`.

Do not change `push_subscriptions` schema.

Do not touch child-side local notifications.

Do not add new notification categories beyond geofence alerts.

Do not redesign the geofence product itself.

Keep this narrow and use the current notification system we already strengthened.

Context already confirmed:

- parent push delivery already works through `send-push-notification`

- co-parent recipient resolution already exists through `get_alert_recipients(child_id)`

- geofence detection and reporting already exist on Android

- current audit showed geofence alerts do NOT yet produce real parent push

- the right move is to plug geofence alerts into the existing parent push system, not to build a parallel one

Your job:

Extend the existing notification system so geofence alerts produce a real push notification to the correct recipients.

Hard requirements:

1. First map the real current geofence alert flow before changing anything

Before writing code, identify exactly:

- where geofence alerts are created today

- what table stores them today

- whether Android writes them into `alerts` or another real table/path

- what fields identify them as geofence alerts today

- whether they already appear in the parent dashboard via polling/realtime

- what child_id is available at creation time for recipient resolution

- whether geofence alert creation is one row per event or an update flow

You must preserve the current geofence architecture.

2. Use the existing parent push system

Do not invent a new push path.

Preferred implementation:

- use the same `send-push-notification` edge function

- use the existing `get_alert_recipients(child_id)` helper

- send one push per resolved recipient

Do not redesign delivery.

3. Trigger point

Add push only when a **new geofence alert event is first created**.

Required behavior:

- when the system first records a geofence alert → push once

- do not push repeatedly on polling, reads, later updates, or re-syncs of the same alert row

- do not accidentally re-send on later AI processing/acknowledgement/metadata updates if geofence alerts pass through the `alerts` table

This task is for:

- geofence alert created → push to parents

Not for:

- reminders

- backlog replay

- location history

- repeated “still outside” notifications

- device-local child notifications

4. Recipient resolution

Recipients must be:

- the owner parent

- any accepted co-parent where `receive_alerts = true`

Use the existing `get_alert_recipients(child_id)` helper.

Do not duplicate recipient logic.

5. Push content

Keep the message simple, clear, and parent-facing in Hebrew.

You must first inspect the real current geofence alert payload/content and then choose the smallest safe mapping.

Use real existing child name / alert text / type if already available.

Suggested direction only:

- Title: "התראת מיקום"

- Body:

  - if place/rule is clearly available: "[child_name] יצא/ה מאזור [place/rule]"

  - otherwise: "זוהתה חריגה מאזור מוגדר"

Use the real child name if it is already easily available in the current flow.

If not, fall back safely.

Do not redesign push templates globally.

Suggested URL:

- link to the relevant existing parent alert/detail surface already used for alerts

Use the smallest safe existing route. Do not invent a new page.

6. Narrow implementation options

Use the smallest safe point in the current architecture.

Acceptable options:

- DB trigger on insert into the real geofence-alert table/path

- edge/function path already involved in geofence alert creation

- another narrow existing backend point

Choose the smallest safe implementation that:

- runs exactly once per new geofence alert

- has access to child_id

- can call `get_alert_recipients`

- can invoke `send-push-notification`

Do not add a big queueing system unless absolutely necessary.

7. Important safety rule if geofence alerts already flow through `alerts`

If geofence alerts are stored in the shared `alerts` table:

- do not accidentally piggyback them onto the AI `analyze-alert` pipeline unless that is already their real push path today

- do not create duplicate pushes from both a DB trigger and an edge function

- choose one source of truth for geofence push and keep it deterministic

8. Backward compatibility

If there is no co-parent:

- behavior should be owner-only, exactly as expected

If a co-parent exists but `receive_alerts = false`:

- owner gets push

- co-parent gets nothing

If geofence alerts already appear in dashboard UI:

- that behavior must remain unchanged

Do not break:

- current geofence detection flow

- current parent alerts UI

- current parent push categories already working

- current AI alert processing

9. Exact implementation proof required

Return exact implementation proof, not a summary.

I need:

1. Exact files changed

2. Exact current geofence alert creation flow you found

3. Exact trigger point chosen for push and why

4. Exact use of `get_alert_recipients(child_id)`

5. Exact use of `send-push-notification`

6. Exact payload text used

7. Exact proof that push fires only on first creation of a geofence alert event

8. Exact backward compatibility proof

9. Migration / deploy status

10. Typecheck / function deploy result

11. Explicit report:

   - did it pass on the first try

   - if not, what failed first

   - exactly what you fixed

Final restriction:

Do not redesign the notification system.

Do not widen scope into geofence reminders/history/repeat notifications.

Do only “geofence alert created → parent/co-parent push” on top of the existing system, and report exactly what changed.
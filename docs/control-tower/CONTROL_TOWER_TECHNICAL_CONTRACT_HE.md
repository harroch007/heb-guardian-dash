# Kippy Control Tower — חוזה טכני Foundation

סטטוס: `IMPLEMENTATION_IN_PROGRESS`
גרסה: `CT-R0-v1`
תאריך הקפאה: 2026-07-31
בעל החלטה: מנכ״ל Kippy

## 1. מטרת ה־Foundation

ה־Foundation מכין את שכבת התפעול של Kippy כאילו ערוץ החברה מחובר, בלי
להעמיד פנים שחיבור Meta כבר קיים ובלי להחליש את גבולות הפרטיות של V2.

הוא כולל:

- זהויות Staff ו־Agent;
- RBAC לפי תפקיד, הרשאה, סביבה ו־Case;
- Company Inbox, Conversation, Case ו־Customer 360;
- Audit נפרד ובלתי ניתן לשינוי;
- שלד Action / Approval / Outbox שאינו מבצע פעולות חיצוניות;
- מתאם WhatsApp מאומת חתימה, מוצפן ו־fail-closed;
- Agent mode מסוג `shadow` בלבד;
- סביבת UI סינתטית מלאה לצורכי פיתוח ובדיקות;
- מסכי Production שנחסמים כאשר Staff backend אינו מוגדר.

## 2. בסיסי הקוד וגבולות האינטגרציה

| שכבה | בסיס מקומי מאומת | worktree | branch |
| --- | --- | --- | --- |
| Web | `e9d2dd0` | `C:\tmp\KippyControlTower-web` | `codex/control-tower-web-foundation` |
| Backend | `cd3ee0e` | `C:\tmp\KippyControlTower-backend` | `codex/control-tower-backend-foundation` |

הענפים אינם מוזגים אוטומטית אל ה־checkouts הפעילים. לפני אינטגרציה יש לבצע
rebase או cherry-pick על מצב V2 החדש, להריץ migration reset ובדיקות חוזה מלאות.

## 3. מצבי הפעלה

### 3.1 Control Tower Web

```text
Development + VITE_CONTROL_TOWER_FIXTURES=true
  -> נתונים סינתטיים בלבד, ללא network

Production
  -> Remote Staff backend בלבד
  -> אם אינו מוגדר: STAFF_BACKEND_NOT_CONFIGURED
  -> לעולם אין fallback ל-fixture או ל-V1 admin
```

### 3.2 WhatsApp channel

```text
disabled    -> GET ו-POST חסומים
verify_only -> אימות callback בלבד
ingest_only -> אימות, הצפנה ושמירה; ללא Agent וללא outbound
shadow      -> כמו ingest_only + Agent job מוצע/מתועד בלבד
live        -> דורש בנוסף release policy ו-kill switch פתוח
```

גם במצב `live`, ה־Foundation הנוכחי אינו שולח הודעות ואינו מפעיל Device action.

### 3.3 Agent runtime

```text
AGENT_EXECUTION_MODE=shadow
AGENT_EXTERNAL_MODEL_MODE=disabled
```

תוצאת Agent יכולה להיות סיווג, ניתוב, בקשת אדם, בקשת אימות או טיוטה. היא
אינה יכולה לבצע effect חיצוני, להשיב ללקוח או לשנות הגדרת הורה/ילד.

## 4. חוזה הרשאות

הרשאה נבדקת בצד השרת. הסתרת רכיב UI אינה authorization.

תפקידי בסיס:

- `ceo`
- `platform_super_admin`
- `support_manager`
- `support_agent`
- `device_support`
- `finance`
- `trust_and_safety`
- `privacy_dpo`
- `security_sre`
- `growth_product_data`
- `auditor`

הרשאות Foundation מינימליות:

```text
control.session.read
fixture.read
inbox.read
conversation.read
case.read.assigned
case.read.all
message.read.redacted
service360.read.masked
device.install.read
device.health.read
device.command_lifecycle.read
safety.parent_safe.read
audit.read
iam.read
```

כל assignment כולל סביבה, scope, תוקף, מעניק ו־reason code. אין seed של עובד
אמיתי ואין bootstrap אוטומטי של CEO.

## 5. מודל הנתונים

### 5.1 IAM

- `v2_admin_principals`
- `v2_staff_profiles`
- `v2_agent_identities`
- `v2_staff_roles`
- `v2_staff_permissions`
- `v2_staff_role_permissions`
- `v2_staff_role_assignments`

### 5.2 שירות

- `v2_support_contacts`
- `v2_support_channel_identities`
- `v2_support_conversations`
- `v2_support_messages`
- `v2_admin_cases`
- `v2_admin_case_conversations`
- `v2_admin_case_participants`
- `v2_admin_case_events`
- `v2_agent_delegations`

### 5.3 Governance

- `v2_admin_action_requests`
- `v2_admin_approvals`
- `v2_admin_outbox`
- `v2_admin_audit_events`

Action, Approval ו־Outbox קיימים כשלד inert בלבד. אין RPC שמאשר או משגר
פעולה בשלב זה.

### 5.4 גישת DB

לכל טבלה חדשה:

```sql
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
ALTER TABLE ... FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ... FROM PUBLIC, anon, authenticated, service_role;
```

הלקוח קורא רק דרך פונקציות `SECURITY DEFINER` עם `search_path` ריק. פונקציות
Staff ניתנות ל־`authenticated`; provisioning ו־channel ingestion ניתנים
ל־`service_role` בלבד.

## 6. חוזי RPC

### 6.1 Session וקריאות Staff

```text
v2_admin_get_session()
v2_admin_list_fixture_scenarios()
v2_admin_list_inbox(...)
v2_admin_get_conversation(conversation_id)
v2_admin_get_case(case_id)
v2_admin_list_case_messages(case_id, ...)
v2_admin_list_case_timeline(case_id, ...)
v2_admin_get_service360(case_id)
v2_admin_get_parent_safe_incident(case_id)
v2_admin_list_case_actions(case_id)
v2_admin_list_audit_events(case_id, ...)
```

כל קריאת customer data כותבת אירוע Audit לפני החזרת התוצאה. כל תגובה משתמשת
במעטפת עם `schema_version`, `generated_at`, `source_mode`, `data`, `page`
ו־`audit_event_id`.

### 6.2 Provisioning

```text
v2_admin_provision_staff_service(user_id, display_name, role_keys, reason)
```

ה־Foundation מסרב provisioning ל־Production. כל שינוי IAM מתועד.

### 6.3 WhatsApp inbound

```text
v2_admin_ingest_whatsapp_webhook_service(
  target_environment,
  target_channel_mode,
  target_envelope_sha256,
  target_received_at,
  target_items
)
```

הפונקציה מיועדת ל־`service_role` בלבד. צורת התוצאה כוללת
`schema_version=1`, מונה מעטפה כפולה, מוני פריטים ורשימות Conversation,
Case ו־shadow jobs. כשל RPC או תוצאה שאינה עומדת בחוזה מחזירים `503`, כדי
לאפשר ל־Meta לנסות שוב ולא לאבד פנייה.

## 7. חוזה webhook

### 7.1 GET

- `hub.mode` חייב להיות `subscribe`;
- `hub.verify_token` מושווה בזמן קבוע;
- הצלחה מחזירה את `hub.challenge` בדיוק כ־`text/plain`;
- config חסר מחזיר `503`;
- אין CORS ואין רישום token/challenge ללוג.

### 7.2 POST

הסדר קשיח:

1. קריאת raw bytes פעם אחת;
2. בדיקת content type וגודל;
3. אימות `X-Hub-Signature-256` על raw bytes;
4. רק לאחר הצלחה — JSON parse;
5. בדיקת WABA, phone-number ID ו־messaging product;
6. מעבר על כל entries, changes, messages, statuses ו־errors;
7. הצפנה ונרמול;
8. commit אטומי דרך ה־RPC;
9. ורק אז `200 EVENT_RECEIVED`.

אין הורדת מדיה, Agent execution או reply בתוך ה־webhook.

## 8. הצפנה, פרטיות ו־retention

נשמרים ב־plaintext רק identifiers של ספק, timestamps, type/status, ciphertext
reference, key id, byte length, HMAC ו־retention metadata.

מוצפנים:

- `wa_id` ומספר טלפון;
- שם פרופיל;
- טקסט, caption ו־filename;
- location, contact cards, orders, referrals ו־interactive payloads;
- תוכן מדיה, OCR ותמלול.

חוזה:

```text
AES-256-GCM
nonce אקראי של 96 bit
key_id גרסאי
AAD קושר environment + account + provider message + direction + schema
contact lookup = HMAC-SHA256 עם מפתח ייעודי
content digest = HMAC-SHA256 עם מפתח נפרד
```

אין raw provider payload, media URL, plaintext, OTP או secret בלוגים או ב־Audit.

## 9. Customer 360

ה־RPC מקבל `case_id` בלבד. הוא אינו מאפשר לעובד להזין family/child/device
שרירותיים.

בשלב Foundation הוא רשאי לקרוא רק מחוזי V2 שקיימים בבסיס המאומת: families,
guardian memberships, children, child-install lifecycle, protected devices,
monitoring state, health events, command lifecycle בלי payload, ו־push health
מצטבר.

אסור להחזיר email או contact identity גולמי, activation token, device
credentials, push endpoint, command payload, incident context לא מאושר או
capabilities JSON גולמי ללא allowlist.

תחומים שטרם מוזגו — הגדרות בקרת הורים, שימוש, אפליקציות, geofence, location
ו־revision — מוחזרים עם `NEW_DOMAIN_REQUIRED`, ולא מומצא עבורם ערך.

## 10. UI

נתיב: `/control-tower/*`.

Desktop רחב מציג שלושה panels:

```text
Customer 360 | Conversation | Company Inbox
```

במובייל הזרימה היא master/detail, ו־Customer 360 הוא subroute. כל המסך RTL;
זמנים, גרסאות ומזהים מוצגים ב־LTR באמצעות `bdi`.

מצבי חובה: loading, empty, no selection, unauthenticated, MFA required,
forbidden, backend unavailable, partial/stale, ambiguous identity, attachment
scanning/blocked, takeover pending, human active, delivery failed ו־SLA breached.

`LOCATE_NOW` ו־`RING_DEVICE` אינם מופיעים. פעולה שחוזה השרת שלה חסר מוצגת
כחסומה ולא ככפתור שעובד לכאורה.

## 11. נתוני בדיקה

Fixture קיים רק ב־development/test ומכיל שישה תרחישים סינתטיים: מכשיר
Samsung במצב interrupted, prospect ללא Case, identity ambiguous, Xiaomi עם
diagnostics unavailable, פנייה רגישה בנושא child safety ללא תוכן הילד וכשל
delivery בפניית billing.

אין fixture עם מספר אמיתי, email אמיתי, OTP, token, credential, endpoint,
location או child WhatsApp content.

## 12. שער הפעלה ליום חיבור המספר

לפני מעבר מ־`verify_only` ל־`ingest_only`:

- הוכחה שהמספר נשלט וניתן לאימות אצל Meta;
- WABA ו־phone-number ID מאומתים;
- webhook callback נרשם ונבדק;
- secrets הוזנו ב־secret store ולא בקוד;
- signing test אמיתי עבר;
- migration ו־contract tests עברו על בסיס V2 המעודכן;
- Staff identity אחד לפחות provisioned ב־Staging עם MFA;
- retention ו־deletion policy אושרו;
- alerting ל־signature failures ול־DB outage פעיל.

לפני `shadow` נדרשים evaluation dataset מאושר ואפס model-provider egress.

לפני `live` נדרשים אישורי provider/model/ZDR/retention/residency, כיסוי human
escalation, outbound policy, kill switch, threat review ו־release gate מלא.

## 13. Definition of Done ל־Foundation

- migration עולה מאפס ונבדקת בחוזה SQL;
- כל הטבלאות עם RLS + FORCE RLS וללא direct grants;
- provisioning ו־channel ingestion הם service-only;
- webhook tests מוכיחים אימות raw-byte ו־fail-closed;
- UI build/lint עוברים;
- Playwright עובר ב־390px וב־1440px;
- Production build מתעלם מ־fixture flag ואינו מכיל fixture data;
- אין secret, מספר אמיתי או PII ב־diff;
- אין merge או deployment עד review מול מצב V2 העדכני.

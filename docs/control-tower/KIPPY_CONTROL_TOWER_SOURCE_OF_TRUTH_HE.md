# Kippy Control Tower ו־AI Operations — מקור אמת

סטטוס: בסיס המוצר ו־Phase 0 אושרו; תשתית ה־Control Tower נמצאת במימוש מבודד
בעל החלטה: מנכ״ל Kippy
תאריך הקפאה ראשוני: 2026-07-31
תחום: אדמין צוות, שירות ותפעול, WhatsApp Kippy 1 ומערכת אייג׳נטים
מצב קוד: מימוש Foundation החל ב־worktrees ייעודיים; חיבור Meta והפעלת Production חסומים עד השלמת בעלות/אימות המספר והזנת secrets

## 1. מטרת המסמך

מסמך זה מגדיר את שכבת ההפעלה הפנימית של Kippy. הוא אינו מחליף את חוזי
Kippy V2, אינו משנה את צינור בטיחות הילד ואינו מעניק לעובדים או לאייג׳נטים
גישה ישירה למידע שאסור להורה לראות.

Kippy Control Tower אינו רק דשבורד. הוא מערכת הפעלה לחברה שמחברת:

- את מספר WhatsApp הרשמי Kippy 1;
- אייג׳נט Front Office שפועל מול לקוחות;
- Case Workflow Service שמנהל כל Case עד סגירה;
- אייג׳נטים מומחים לפי תחום;
- צוות אנושי עם הרשאות מדורגות;
- Service Center ו־Customer 360;
- שכבת מדיניות, אישורים, Audit ולמידה מבוקרת.

המסמך הוא נקודת הביקורת לפני כתיבת סכמות, APIs, UI או חיבור WhatsApp.

## 2. סטטוס החלטות

### 2.1 החלטות שאושרו

| מזהה | החלטה |
| --- | --- |
| D-001 | המנכ״ל רואה את כל התחומים והמידע האופרטיבי, אך לא secrets, credentials או תוכן WhatsApp שגרתי של ילדים. |
| D-002 | ייבנה פורטל צוות נפרד עם MFA והפרדה ברורה בין Staging ל־Production. |
| D-003 | לא תתאפשר התחזות מלאה ושקטה להורה. תמיכה תשתמש ב־Support Session מוגבל, מתועד ובקריאה בלבד ככל האפשר. |
| D-004 | ההרשאות יהיו לפי תפקיד, פעולה, שדה, תיק, מטרה, סביבה וזמן; לא לפי הסתרת טאבים בלבד. |
| D-005 | התחום הראשון למימוש הוא שירות לקוחות ותפעול מכשירים. |
| D-006 | Kippy 1 הוא כיום המספר היחיד שמייצג את Kippy והערוץ הראשי לכל סוגי הפניות; המערכת לא תחסום ערוץ fallback עתידי. |
| D-007 | Kippy 1 יהיה אייג׳נט AI מתקדם ושקוף לגבי היותו AI, ולא בוט תפריטים פשוט. |
| D-008 | יעד השירות האוטומטי הוא זמינות 24/7 לאחר מעבר Meta, SLO ו־evaluation gates; פעולות בטוחות יוכלו להתבצע אוטונומית וחריגות יועברו לאדם. |
| D-009 | כל אירוע ינוהל מרגע הקבלה ועד אימות פתרון ויתועד; רק אירוע זכאי עשוי ליצור Knowledge Candidate בתהליך למידה מבוקר. |
| D-010 | כל אייג׳נט יהיה מומחה בתחום אחד עם כלים, ידע, מבחני איכות ומגבלות הרשאה ייעודיים. |

### 2.2 הנחות שטרם אומתו

- על מכשיר Kippy 1 מותקנת ככל הנראה אפליקציית WhatsApp Business.
- טרם אומתו הבעלות וההגדרות ב־Meta Business Portfolio, קיום WABA, מצב
  אימות העסק, או האפשרות לחבר את אותו מספר ל־Cloud API בלי לפגוע בהיסטוריה
  ובשימוש הקיים.
- אין עדיין SLA אנושי או כוננות בטיחותית שאפשר להבטיח 24/7.

הנחות אלו הן Gate טכני לפני חיבור הערוץ, ואינן סיבה לשנות כעת דבר בטלפון.

### 2.3 מקרא סטטוסים

| סטטוס | משמעות |
| --- | --- |
| APPROVED | החלטת מוצר שהמנכ״ל אישר |
| VERIFIED_CURRENT | עובדה שאומתה בקוד או בחוזי V2 |
| PROPOSED | חוזה יעד שמוצע במסמך ודורש הקפאת Phase 0 |
| DISCOVERY_REQUIRED | תלוי בבדיקה טכנית, משפטית או תפעולית |
| PROHIBITED | אסור במצב הנוכחי |

החלטות בסעיף 2.1 הן APPROVED. תיאור מצב V2 הוא VERIFIED_CURRENT. מבני
Case, Agent, Action, UI, SLA ו־Data Model הם PROPOSED אלא אם נכתב אחרת.
מצב Kippy 1, Meta, retention, ZDR וכיסוי אנושי הוא DISCOVERY_REQUIRED.

## 3. מצב V2 שעליו מתבססים

- Kippy V2 מורכב משלוש שכבות נפרדות: Android של הילד, PWA של ההורה ו־Supabase V2.
- ה־backend של בקרת ההורים קיים ב־Staging, אך Android וה־PWA עדיין אינם
  מחוברים אליו מקצה לקצה.
- ה־PWA הנוכחי עדיין נשען על V1. קוד V1 יכול לשמש donor ל־UX בלבד; אסור
  לאדמין החדש לבצע דרכו קריאות או כתיבות לייצור.
- ב־V2 קיימים Guardian ו־Device principals, אך אין Staff Identity, Staff
  RBAC, Support Cases או Agent Identity.
- לכן אין כיום אף פעולת Staff או Agent מורשית, גם כאשר קיימת פעולה מקבילה
  להורה. נדרש Admin Control Plane חדש בצד השרת.

האדמין הקיים אינו בסיס backend למוצר החדש. אין למחזר את מודל
admin/user הבינארי, direct table writes, session מלא של הורה או דומיינים
שהוצאו מ־V2 כגון משימות, פרסים, צ׳אט ובקשות זמן מהילד.

## 4. עקרונות שאינם ניתנים לעקיפה

1. V2 בלבד. אין נתיב fallback ל־V1.
2. Default deny. כל קריאה ופעולה נאכפות בשרת.
3. Least privilege לאדם ולאייג׳נט.
4. שיחת שירות עם ההורה מופרדת לחלוטין מתוכן WhatsApp של הילד.
5. היסטוריית WhatsApp שגרתית של הילד אינה מקור חיפוש, זיכרון או אימון.
6. Secrets, OTP, tokens, hashes, credentials, encryption keys ו־worker
   internals אינם מוצגים לאף תפקיד.
7. כל נתון אופרטיבי מציג מקור, זמן תצפית, זמן קבלה ורמת freshness.
8. כל כתיבה allowlisted, typed, idempotent, מצומצמת למשאב ובעלת postcondition.
9. הצלחת API אינה הוכחת פתרון; Case נסגר רק לאחר אימות תוצאה.
10. כל קריאה רגישה, denial, החלטה, handoff ופעולה נכתבים ל־Audit append-only.
11. מודל AI אינו מחליף state machine, policy engine או approval gateway.
12. אייג׳נט אינו משנה בעצמו prompt, policy, כלים, הרשאות או גרסה בפרודקשן.
13. לכל פעולה רגישה יש owner אנושי, reason, expiry ויכולת rollback או recovery.
14. אין להציג offline כ־uninstalled. מציגים רק את מה שנצפה: late,
    interrupted או unknown.
15. אין הבטחת מענה אנושי 24/7 לפני שקיימת כוננות אמיתית.
16. “לתעד הכול” פירושו תיעוד עובדות, evidence, גרסאות, החלטות, reason codes,
    פעולות ותוצאות. אין לשמור או לחשוף chain-of-thought פרטי של מודל.

## 5. ארכיטקטורה לוגית

~~~text
הורה / לקוח
    |
WhatsApp Kippy 1
    |
WhatsApp Channel Gateway
    |-- webhook verification
    |-- idempotency / status / attachments
    |
Customer-facing Front Office Agent
    |
Identity + Verification + Risk Gate
    |
Deterministic Case Workflow Service
    |
Accountable Specialist Agent
    |
Policy + RBAC/ABAC + Approval + Action Gateway
    |
V2 Staff APIs / Safe Read Models / Domain Systems
    |
Independent Postcondition Verification
    |
Reply + Case Timeline + Immutable Audit

צוות / מנכ״ל
    |
Kippy Control Tower
    |
Staff IAM + MFA + Internal Operations Copilot
    |
אותו Case Workflow Service ואותו Action Gateway
~~~

האייג׳נט שפונה ללקוח וה־Copilot הפנימי הם שתי זהויות שונות:

- Front Office Agent פועל כ־service principal מצומצם לערוץ, לשיחה ולתיק.
- Internal Copilot פועל בתוך הרשאות המשתמש המחובר, התיק והמטרה.
- אף אחד מהם אינו מקבל Guardian session או service_role.

### 5.1 Actor registry מוצע

| Actor | סוג | Principal והרשאה |
| --- | --- | --- |
| Customer | אדם חיצוני | רמת V0–V3 ומשאבים השייכים למשפחה המאומתת |
| Front Office Agent | customer-facing service principal | ערוץ, Conversation, Case, purpose ו־tool allowlist מצומצם |
| Case Workflow Service | שירות דטרמיניסטי, לא LLM Agent | state transitions בלבד לפי guards קבועים |
| Domain Specialist Agent | service principal ייעודי לתחום | Case, domain tool allowlist, purpose, sensitivity ו־approval |
| Internal Operations Copilot | human-delegated agent | חיתוך הרשאת העובד, delegation, Case ו־tool allowlist |
| Human Staff | משתמש צוות | Staff RBAC/ABAC, MFA, assignment ו־purpose |
| Approval/Policy Service | שירות דטרמיניסטי | policy evaluation ו־approval validation; אינו actor עסקי |

Handoff מעביר משימה ו־evidence references בלבד; הוא אינו מעביר permission.
ה־Domain Specialist מחשב effective permission מחדש עבור כל tool call.
Guardian verification level ו־Staff authentication assurance הם שדות נפרדים
ואינם ניתנים להמרה זה בזה.

## 6. חוזה WhatsApp Kippy 1

### 6.1 תפקיד הערוץ

Kippy 1 הוא שער הכניסה האחיד לפניות:

- התקנה, QR ו־OTP;
- הרשאות ובריאות מכשיר;
- בקרת הורים;
- monitoring והתראות;
- חיובים;
- פרטיות;
- בטיחות;
- מכירה ושיתופי פעולה;
- תלונה, משוב ופנייה כללית.

המודל הפנימי יהיה channel-agnostic כדי לאפשר בעתיד email, web chat או
טלפון בלי להחליף את מודל ה־Case.

בפתיחת אינטראקציה האייג׳נט מזדהה בשקיפות כעוזר AI של Kippy. בעת Takeover
הלקוח מקבל הודעה ברורה שעבר לאדם; אין התחזות של AI לאדם או להפך.

### 6.2 חיבור יעד

חיבור היעד הוא WhatsApp Business Platform Cloud API הרשמי, עם webhooks
לקבלת הודעות וסטטוסי מסירה. אין לבנות אוטומציה באמצעות WhatsApp Web,
שליטה בדפדפן, scraping או שיתוף הטלפון והקוד בין עובדים.

לפני מימוש יש לבצע Discovery רשמי מול Meta:

1. לאמת שהאפליקציה היא WhatsApp Business.
2. לאמת בעלות על המספר ועל Meta Business Portfolio.
3. לאמת WABA, business verification ו־display name.
4. לבדוק את מסלול onboarding העדכני למספר קיים.
5. לבדוק migration או coexistence בלי להניח שהם זמינים לחשבון.
6. לתעד השפעה על היסטוריה, אפליקציה, linked devices ותבניות.
7. לאשר שהשימוש הוא אייג׳נט עסקי תחומי של Kippy ולא assistant כללי.
8. להקפיא את מדיניות חלון השירות, templates, opt-in ו־pricing לפי כללי Meta
   שיהיו תקפים ביום המימוש.
9. להגדיר Business Continuity לערוץ outage בלי להניח שאפליקציית הטלפון
   ממשיכה לעבוד במקביל ל־API; fallback יופעל רק לאחר אימות טכני.

### 6.3 קליטת הודעה

כל אירוע נכנס עובר:

1. אימות webhook וחתימה.
2. normalization.
3. deduplication לפי provider message ID.
4. סריקת attachment לפני פתיחה או עיבוד.
5. security ו־safety gate.
6. זיהוי contact ורמת אימות.
7. סיווג intent, domain, priority ו־risk.
8. correlation לשיחה ול־Case קיים או יצירת Case חדש.
9. מענה, handoff או בקשת מידע חסר.

לכל הודעת שירות נשמרים רק השדות הדרושים:

- provider message ID;
- provider account/phone-number scope לצורך uniqueness;
- channel identity וטלפון מנורמל;
- conversation ו־case;
- direction ו־message type;
- encrypted service-content או reference מוגן אליו, עם redacted view;
- provider/server timestamps;
- reply reference;
- delivery/read/failure state;
- attachment metadata ו־scan state;
- retention class ו־sensitivity.

Raw provider payload נשמר רק אם נדרש תפעולית, מוצפן, לתקופה מינימלית
ובגישה מוגבלת ל־Platform Security.

סכמת הערוץ תפריד בין Channel Event, Message, Media ו־Delivery Status.
message_type המוצע כולל text, image, video, audio, voice, document, location,
contact, interactive, reaction, sticker ו־unsupported. View-once או סוג שאינו
נתמך לא נשמר או מעובד מעבר למה שמדיניות Meta והפרטיות מאשרות.

- uniqueness מחושב לפחות לפי provider account, phone-number ID ו־message ID.
- status events מחוץ לסדר מתעדכנים באופן מונוטוני ואינם “מחזירים אחורה” delivery.
- media נשאר quarantine עד scan; מודל אינו מקבל אותו לפני eligibility gate.
- תוכן שיחת השירות מוצפן, role-scoped ו־retention-bound.
- תוכן השירות אינו משוכפל ל־general memory ואינו מתערבב עם WhatsApp של הילד.
- עיבוד OCR/transcription או attachment על ידי ספק AI דורש חוזה ZDR/egress
  מאושר; עד אז הוא disabled.

כל inbound יוצר או מעדכן Conversation. Case נוצר רק כאשר נדרש טיפול
תפעולי, SLA, state change, זיהוי, חקירה, סיכון, handoff או מעקב רב־שלבי.
FAQ ציבורי שנענה ונפתר יכול להישאר Conversation בלבד.

Conversation אחד יכול לקשר כמה Cases כאשר קיימים כמה intents. Correlation,
merge, duplicate ו־reopen חייבים לשמור את ההודעות המקוריות ואת היסטוריית
הבעלות בלי להעתיק content בין תיקים שלא מורשים לראותו.

### 6.4 זהות ואימות

התאמת מספר הטלפון לחשבון הורה היא candidate match, לא הוכחת זהות.

| רמה | משמעות | מידע ופעולות מותרים |
| --- | --- | --- |
| V0 Unknown | מספר לא מוכר | מידע ציבורי, מכירה, FAQ ופתיחת פנייה |
| V1 Channel Possession | שליטה בשיחת WhatsApp הנוכחית | עדכון לא רגיש על הפנייה |
| V2 Authenticated Guardian | support verification challenge שנקשר ל־Guardian session מאומת | Customer 360 תומך־שירות ופעולות R2 מוצעות |
| V3 Action-bound Step-up | אימות מחודש, role שנבדק ב־verifier ייעודי ו־approval קשור לפעולה | פעולות R3 רק אם המדיניות אישרה אותן |

כללי חובה:

- אין לחשוף שם ילד, מצב מכשיר, חוב, incident או מיקום לפני הרמה הנדרשת.
- secure link מכיל challenge אטום וחד־פעמי בלבד. הוא קצר־חיים, replay-protected,
  rate-limited וקשור ל־conversation, contact, family, role ולפעולה. הוא אינו
  מכיל PII או session/access token רב־שימושי.
- כמה חשבונות לאותו מספר או מספר משותף עוברים ל־Identity Review.
- עובד או אייג׳נט לעולם אינם מבקשים מהלקוח סיסמה, OTP, recovery code או
  device credential בהודעה.
- פונה שהוא קטין אינו מקושר אוטומטית לחשבון הורה.

קיימים שני חוזים נפרדים לחלוטין:

- support_verification_challenge מאמת Guardian לצורך שירות.
- child_install_otp משמש רק לצימוד אפליקציית הילד לפי חוזה ההתקנה.

child_install_otp לעולם אינו הוכחת זהות לשירות, אינו נקרא על ידי Staff או Agent
ואינו נשמר ב־Inbox, Case, prompt או Audit. ה־Owner/Guardian role ל־V3 ייבדק
על ידי verifier חדש; אין למחזר את helper הקיים שמאשר כל membership פעיל.

## 7. סיווג, עדיפות וניתוב

| Domain | דוגמאות | בעלים יעד |
| --- | --- | --- |
| Pre-sales | מחיר, התאמה, זמינות | Sales/Growth |
| Registration | הרשמה, כניסה, אימייל או טלפון | Customer Support |
| Installation | QR, OTP, pairing והתקנה | Installation Expert |
| Permissions | Accessibility, Notification Listener, battery/OEM | Installation + Device Ops |
| Parental Controls | זמן מסך, apps, schedules, geofence, lost mode | Parental Controls |
| Monitoring | heartbeat, interrupted, push או capture readiness | Device Ops |
| Billing | חבילה, חיוב, חשבונית, קופון או refund | Finance |
| Privacy | export, delete, consent או retention | Privacy |
| Security | השתלטות, זהות או token חשוד | Security |
| Child Safety | פגיעה, איום או אירוע בטיחות | Trust & Safety + אדם |
| Complaint | כשל חוזר, תלונה או סיכון נטישה | Support Manager |
| Product Feedback | באג, הצעה וחוויית משתמש | Product Intake |
| Legal/Media/Partner | עו״ד, עיתונות, שותף או ספק | תור ייעודי |
| Spam/Abuse | phishing, הטרדה או תוכן זדוני | Quarantine |

Priority ראשוני:

- S0 Critical: סכנה מיידית, חשד להשתלטות, דליפת מידע או outage רחב.
- S1 Urgent: monitoring interrupted, לקוח חסום, כשל pairing חוזר או חיוב כפול.
- S2 Normal: תקלה רגילה או שאלה בחשבון.
- S3 Low: מידע, משוב או feature request.

Low confidence או multi-intent עוברים ל־Triage. Safety, Security, Privacy,
Legal ופעולה כספית אינם נסגרים אוטומטית.

Kippy אינו שירות חירום. פנייה שמצביעה על סכנה מיידית מקבלת הנחיה מאושרת
לפנות לגורם חירום מתאים ומוסלמת לאדם; אין לנסח הבטחה לכיסוי אנושי שאינו קיים.

## 8. מודל Case קנוני

### 8.1 כלל אחריות

- לכל Case יש accountable_case_owner פעיל אחד: אדם או Domain Specialist.
- conversation_responder אחד מחזיק lease לשליחת תשובות: Front Office או אדם.
- resolver_agent הוא המומחה שמבצע את החקירה, ויכול להיות שונה מה־responder.
- human_supervisor הוא בעל ההסלמה והאישור, לא בעלים מקביל.
- Case Workflow Service בלבד משנה state לפי transition guards.
- אייג׳נטים מסייעים מחזירים evidence; הם אינם סוגרים את ה־Case בעצמם.
- Case אינו נסגר בלי postcondition ובלי הודעת סיכום ללקוח כאשר הדבר מתאים.
- Takeover מחליף את conversation_responder. שינוי accountable owner הוא
  transfer נפרד, אטומי ומתועד.

### 8.2 State machines נפרדים

Message ingestion:

~~~text
RECEIVED -> VALIDATED -> PERSISTED
    |           |
    |           -> DUPLICATE
    -> REJECTED
~~~

DUPLICATE ו־REJECTED הם terminal ואינם ממשיכים ל־Triage.

Conversation:

~~~text
OPEN
  -> AI_ACTIVE
  -> TAKEOVER_REQUESTED
  -> HUMAN_ACTIVE
  -> WAITING_FOR_CUSTOMER / WAITING_FOR_HUMAN
  -> RESOLVED
  -> CLOSED
~~~

Conversation יכול להישאר AI_ACTIVE ולהיסגר בלי Case עבור FAQ ציבורי.
כל responder transition דורש lease guard.

Case:

~~~text
OPEN
  -> TRIAGED
  -> IDENTITY_PENDING, אם נדרש
  -> WORKING
       -> WAITING_FOR_CUSTOMER
       -> WAITING_FOR_DATA
       -> WAITING_FOR_HUMAN
       -> WAITING_FOR_EXTERNAL
  -> RESOLUTION_PROPOSED
  -> VERIFYING_RESOLUTION
  -> RESOLVED
  -> CLOSED
~~~

כל WAITING state שומר resume_state, deadline ו־wake condition. REOPENED
פותח מקטע lifecycle חדש ושומר את ה־outcome המקורי.

Action Request:

~~~text
DRAFT
  -> POLICY_CHECKED
  -> APPROVAL_PENDING, אם נדרש
  -> AUTHORIZED
  -> QUEUED
  -> DISPATCHED
  -> ACKNOWLEDGED, אם הפרוטוקול תומך
  -> VERIFYING
  -> VERIFIED

Terminal alternatives:
DENIED / DECLINED / EXPIRED / CANCELLED / FAILED_FINAL
Retryable alternative:
FAILED_RETRYABLE -> QUEUED with the same idempotency key
~~~

Handoff:

~~~text
PROPOSED -> ACCEPTED -> WORKING -> COMPLETED
        |-> REJECTED
        |-> EXPIRED
        |-> NEEDS_CONTEXT / NEEDS_AUTHORITY / BLOCKED_EXTERNAL
~~~

כל transition כולל actor, agent, reason, evidence, timestamp, policy version,
expected precondition, authorized actor, terminality, timeout, resume state
ו־next deadline.

### 8.3 שדות Case

- case ID, conversation ID ו־channel;
- contact, verification level ו־guardian/family reference;
- domain, category, intent ו־priority;
- sensitivity ו־privacy class;
- queue, accountable_case_owner, conversation_responder lease, resolver_agent
  ו־human_supervisor;
- status, substatus ו־SLA clocks;
- customer request, verified facts, assumptions ו־open questions;
- related child/device/payment/incident/release references;
- proposed, approved, executed and verified actions;
- policy, prompt, model, tool and knowledge versions;
- closure reason, root cause, resolution code ו־reopen count.

### 8.4 Handoff typed

כל handoff כולל:

- sender, receiver, case והסיבה;
- המשימה והתוצר המצופה;
- facts שכבר אומתו ו־evidence references;
- מה עדיין לא ידוע;
- permitted and prohibited actions;
- verification, approval ו־SLA requirements;
- idempotency key ו־stop conditions.

המקבל מחזיר אחת מהתשובות:

- ACCEPTED;
- REJECTED_OUT_OF_SCOPE;
- NEEDS_CONTEXT;
- NEEDS_AUTHORITY;
- BLOCKED_EXTERNAL.

אין silent reassignment, אין handoff בפרוזה בלבד ואין delegation פתוח מסוג
“תבדוק הכול”.

## 9. מערכת האייג׳נטים

### 9.1 אייג׳נטים

| Agent | משימה | גבול מפורש |
| --- | --- | --- |
| Kippy 1 Front Office | שיחה טבעית, הבנת צורך, אימות, סיווג ועדכון הלקוח | אינו מבצע פעולה רגישה או מחפש תוכן ילד |
| Case Workflow Service | ownership, state, deadlines, routing ו־verification | שירות דטרמיניסטי ולא LLM; אינו ממציא state או אישור |
| Internal Operations Copilot | מסייע לעובד לחקור, לסכם ולהציע פעולה | מוגבל להרשאת העובד ול־delegation חתום |
| Customer Support | קשר, ציפיות, SLA וסגירת מעגל | ללא תוכן ילד או שינוי פיננסי |
| Installation Expert | QR, OTP, pairing והרשאות לפי OEM | ללא credential או עקיפת rate limit |
| Device & Fleet | heartbeat, versions, capabilities, commands ו־diagnostics | ללא תוכן שיחות, billing או זהות מיותרת |
| Parental Controls | revisions, policies, schedules, geofences ו־lost mode | אינו עוקף Guardian approval או command contract |
| Trust & Safety | queue בטיחות, parent-safe evidence והסלמה | אינו משנה safety policy ואינו כותב התראה חופשית |
| Finance | plan, entitlement, payment, invoice, coupon ו־refund | ללא תוכן ילד או safety |
| Privacy | consent, DSAR, retention ו־legal hold | אינו מאשר פעולה הרסנית של עצמו |
| Security/SRE | auth, RLS, queues, errors, containment ו־service health | ללא routine content; production change-control חובה |
| Release/Configuration Copilot | מציע, מנתח ומנטר versions, flags, canary ו־rollback | אינו מבצע promotion, deploy או rollback; אדם או CI מאושר מבצעים |
| Growth/Communications | קמפיינים, claims ותבניות | aggregate/minimized data בלבד |
| Executive Analyst | KPIs, מגמות והמלצות למנכ״ל | read-only וללא row-level child content |
| Knowledge & Evaluation | candidates, evals ו־release evidence | offline בלבד; אינו משנה production |

### 9.2 Definition of excellence

“עילוי בתחומו” הוא Gate מדיד, לא כינוי:

- ידע מאושר ומעודכן עם owner ו־effective date;
- כלים מדויקים ומצומצמים לתפקיד;
- golden scenarios ומקרי קצה;
- עברית טבעית, שגיאות כתיב, סלנג ו־RTL;
- prompt-injection ו־adversarial tests;
- confidence calibration ולא רק accuracy;
- השוואה למומחה אנושי על holdout נסתר;
- shadow mode לפני פעולה מול לקוח;
- canary, kill switch ו־rollback;
- KPI ו־error budget נפרדים לכל agent version.

אייג׳נט שלא עבר את ה־Gate נשאר draft או shadow ואינו מקבל כלי production.

### 9.3 היקף המימוש הראשון

הגרסה הראשונה כוללת:

1. Kippy 1 Front Office;
2. Case Workflow Service;
3. Customer Support;
4. Installation Expert;
5. Device & Fleet;
6. Internal Operations Copilot;
7. Human Supervisor כתפקיד אנושי;
8. Audit ו־Knowledge/Evaluation;
9. Executive Analyst לקריאה בלבד.

פניות Finance, Privacy, Safety, Legal ו־Security יזוהו וינותבו, אך לא ינוהלו
אוטונומית עד שקיימים systems of record ומדיניות אישור לכל תחום.

## 10. Service Center ו־Customer 360

### 10.1 מעטפת מידע מחייבת

כל שדה שמגיע ל־UI או לאייג׳נט מוחזר משרת עם:

~~~text
value
source
observed_at
received_at
effective_at
freshness_status
sensitivity
redaction
revision_or_etag
~~~

השרת מחשב freshness ו־masking. כשל שאילתה אינו מוצג כ־0 או כ־healthy.

כל field definition מקבל גם availability:

- EXISTING_V2 — קיים בחוזה V2 מוכח;
- DERIVED_SERVER — מחושב מ־V2 בנוסחה versioned;
- REQUIRES_PROJECTION — הנתון קיים חלקית אך אין Staff-safe projection;
- NEW_COLLECTION_REQUIRED — Android/backend עדיין אינם אוספים אותו בחוזה;
- NEW_DOMAIN_REQUIRED — דומיין עסקי או תפעולי שלם טרם נבנה;
- NOT_COLLECTED — אין מקור ואין להסיק אותו;
- PROHIBITED — אסור להציג או לאסוף.

מטריצת מקור ראשונית:

| שדה | Availability | מקור או כלל |
| --- | --- | --- |
| install status, expiry ו־OTP request count | EXISTING_V2 | v2_child_install_sessions; בלי OTP/token/hash |
| setup step מדויק | NEW_COLLECTION_REQUIRED | UNKNOWN עד חוזה Android מאושר |
| manufacturer/model/app version/contract version | EXISTING_V2 או REQUIRES_PROJECTION | רק השדות שקיימים ב־protected device/health |
| Android OS version ו־build | NEW_COLLECTION_REQUIRED | NOT_COLLECTED עד הרחבת health contract |
| monitoring state ו־deadlines | EXISTING_V2 | monitoring projection; freshness לפי late/interrupted deadlines |
| permission/capability state | REQUIRES_PROJECTION | health events + Capability Policy version |
| desired/applied revision drift | DERIVED_SERVER | settings revision מול device applied revision |
| release eligibility | DERIVED_SERVER | formula versioned; לא inference של מודל |
| OEM suspected restriction | DERIVED_SERVER | reason codes מאושרים בלבד; אחרת UNKNOWN |
| support, billing ו־SLA | NEW_DOMAIN_REQUIRED | אינם קיימים ב־V2 כיום |

לכל שדה ייכתבו ב־Phase 0 source, formula, nullable behavior, verification
level, field permission ו־freshness truth table. אם אין מקור, מוצג UNKNOWN
או NOT_COLLECTED; האייג׳נט אינו משלים את החסר בהשערה.

### 10.2 Header

- verification badge ו־Guardian role;
- משפחה וילד שנבחרו במפורש;
- tier/entitlement לקריאה בלבד;
- active cases;
- monitoring state עם reason code;
- last updated;
- PII ממוסך לפי תפקיד.

### 10.3 התקנה

- install session: created, activated, consumed, expired או cancelled;
- תאריך תפוגה;
- OTP request count ו־rate-limit status, בלי OTP או hash;
- pairing attempts ותוצאתם;
- תאריך pairing והתקנה;
- שלב setup אחרון שהושלם;
- pending requirement והצעד הבא המומלץ.

### 10.4 מכשיר וגרסה

- manufacturer, model ו־Android version;
- Kippy app version ו־build;
- capture/parental contract version;
- protected device status;
- pairing/installation reference ממוסך;
- last seen, last heartbeat ו־boot/session evidence;
- battery כאשר דווח;
- release eligibility ו־update required;
- suspected OEM restrictions.

### 10.5 הרשאות ו־Capabilities

לכל capability:

- display name ו־technical key;
- required by product/release/policy version;
- GRANTED, DENIED, NOT_REQUESTED, REVOKED, NOT_SUPPORTED או UNKNOWN;
- observed_at ו־received_at;
- source וה־reason code;
- השפעה על capture, monitoring או parental enforcement;
- הוראות repair מותאמות ליצרן, דגם וגרסה;
- post-repair verification.

רשימת ה־capabilities אינה hardcoded ב־UI. היא נגזרת מ־Capability Policy
versioned, משום שחוזה התקנת הבטיחות המקורי כלל ארבע יכולות בלבד, בעוד
בקרת ההורים המאוחרת דורשת יכולות נוספות כגון location ו־usage access.
אין לבקש הרשאה שאין מאחוריה feature חי, disclosure ומדיניות Play מאושרת.
עד שארבעת התנאים ו־E2E gate עברו, location/usage capabilities מקבלות
NOT_SUPPORTED ואינן מוצגות כהנחיית תיקון.

### 10.6 Monitoring ו־Device Health

- awaiting_first_heartbeat;
- protected;
- degraded;
- action_required;
- heartbeat_late;
- interrupted;
- recovering;
- revoked;
- last healthy observation;
- late/interrupted deadlines;
- degraded reason codes;
- capture readiness לעומת parental capability readiness.

אין שדה “האפליקציה הוסרה” ללא ראיה שאינה קיימת ב־Android.

### 10.7 בקרת הורים וסנכרון

- desired settings revision;
- applied device revision;
- revision drift ומשך הפער;
- screen-time snapshot freshness;
- installed-app inventory freshness;
- app policy ו־schedule summary;
- geofence/lost-mode state בהתאם להרשאה;
- recent commands: type, status, expiry, result ו־failure code;
- אין payload פנימי, lease או credential.

### 10.8 Push והתראות

- guardian notification permission/status;
- registration health;
- last success או failure;
- delivery summary;
- אין endpoint, p256dh, auth secret או capability token.

### 10.9 Safety

Customer 360 הכללי אינו מציג incident feed.

כאשר Case הועבר ל־Trust & Safety, מוצגים רק:

- confirmed parent-safe incident reference;
- structured category/severity/urgency;
- delivery ו־workflow state;
- evidence references בהתאם להרשאה.

Routine WhatsApp, encrypted transport context ו־unconfirmed incidents אינם
מוצגים, אינם מועתקים ל־Case ואינם נכנסים לזיכרון כללי.

### 10.10 Timeline

ה־timeline מציג:

- inbound/outbound support messages;
- delivery/read/failure;
- verification attempts;
- classification ו־routing;
- assignment ו־handoff;
- diagnostic snapshots;
- action request, approval, execution and result;
- internal note;
- template ID/version;
- SLA, escalation, resolve, close and reopen.

יש הפרדה חזותית וחוזית בין conversation ללקוח, internal notes ו־immutable
security audit.

## 11. רמות פעולה

כל הקטלוג בסעיף זה הוא PROPOSED. פעולה אינה זמינה רק משום שהיא מופיעה
כאן. Availability אפשרי:

- EXISTING_READ_CONTRACT;
- REQUIRES_STAFF_READ_MODEL;
- REQUIRES_STAFF_ACTION_API;
- FUTURE_DOMAIN;
- PROHIBITED_PENDING_POLICY.

### R0-MASKED — Read only

- Customer 360 ממוסך;
- device/install diagnostics שאינם רגישים;
- KPI ו־summary מבוסס evidence;
- playbook.

מותר אוטונומית רק בתוך Case/scope והרשאות. ברירת המחדל היא masked.

### R0-SENSITIVE-REVEAL — Read only but sensitive

PII מלא, application inventory/usage או financial details אינם R0 רגיל.
הם דורשים JIT field allowlist, purpose, fresh step-up, active Case, access
audit ו־time-bound reveal לפני שהערך מגיע ל־UI, לכלי או ל־prompt. Exact
location ו־Safety הם R3 או PROHIBITED לפי action policy. חלק מהשדות נשארים
PROHIBITED גם לאחר step-up.

### R1-INTERNAL — Internal and reversible

- יצירת או עדכון Case;
- classification, tags ו־assignment;
- internal note;
- draft response;
- SLA reminder פנימי.

### R1-COMMUNICATION — External but bounded

- מענה ציבורי או תומך־שירות בתוך Conversation שהלקוח פתח;
- בקשת פרטים חסרים;
- שליחת support verification challenge;
- follow-up שמותר לפי policy.

שליחת הודעה אינה “הפיכה”. היא יכולה להיות אוטונומית רק אם channel policy,
verification/sensitivity, opt-in/window/template rules, idempotency,
recipient binding ו־content policy עברו. delivery status הוא postcondition
של השליחה, לא הוכחה שהבעיה נפתרה.

התשובה יכולה להיות טבעית ומותאמת להקשר, אך מבוססת רק על facts ו־knowledge
מאושרים. נוסח משפטי, בטיחותי, פיננסי או provider-controlled משלב clauses
או template מאושר.

### R2 — Customer or device affecting, bounded

R2 עשוי להיות policy-autonomous לאחר הקפאת מטריצה, או human-required לפי
הפעולה. בכל מקרה נדרשים Guardian verification, Case, purpose, typed Staff
API, permission, idempotency, TTL/rate limit, expected revision כאשר רלוונטי
ו־postcondition verification.

### R3 — Sensitive, destructive or exceptional

R3 דורש לפי הפעולה fresh step-up, Guardian approval הקשור ל־action hash,
reason, ticket, מאשר אנושי שני, time-bound grant, preview/blast-radius,
post-action review ו־customer notification כאשר מתאים.

Guardian approval אינו מחליף מאשר תפעולי שני כאשר four-eyes נדרש.

### 11.1 Action catalog ראשוני

| Action | Risk | Availability כיום | Autonomy מוצע | תנאי מרכזי |
| --- | --- | --- | --- | --- |
| Masked Service 360 read | R0 | REQUIRES_STAFF_READ_MODEL | automatic | Case, purpose, field policy |
| Sensitive field reveal | R0-SENSITIVE | REQUIRES_STAFF_READ_MODEL | human/JIT | step-up, field allowlist, access audit |
| Draft response/note/assignment | R1-INTERNAL | FUTURE_DOMAIN | automatic | Case scope |
| Send public low-risk reply | R1-COMMUNICATION | DISCOVERY_REQUIRED_META | automatic after gate | provider policy, idempotency, no sensitive data |
| Send account-specific reply | R1-COMMUNICATION | REQUIRES_STAFF_READ_MODEL | automatic after V2 verification | verified recipient and facts |
| Request Guardian support verification | R1-COMMUNICATION | REQUIRES_STAFF_ACTION_API | automatic | scoped challenge; never child_install_otp |
| Request Guardian reinstall flow | R2 | REQUIRES_STAFF_ACTION_API | policy-controlled | Guardian verified; activation data sent out-of-band |
| Request child-install OTP resend | R2 | REQUIRES_STAFF_ACTION_API | policy-controlled | Guardian verified; rate limit; code never returned to Staff |
| REPORT_HEARTBEAT | R2 | REQUIRES_STAFF_ACTION_API | policy-controlled | case/device scope, TTL, idempotency |
| REFRESH_SETTINGS | R2 | REQUIRES_STAFF_ACTION_API | policy-controlled | case/device scope, expected revision |
| RING_DEVICE / LOCATE_NOW מטעם שירות | R3 | PROHIBITED_PENDING_POLICY | none | prefer secure deep link for Guardian self-action |
| Lost mode או parental policy בשם הורה | R3 | PROHIBITED_PENDING_POLICY | none | prefer Guardian self-action |
| Exact location/app/safety reveal | R3 | REQUIRES_POLICY_AND_API | human only | JIT, step-up, explicit field scope |
| Revoke/reassign/owner change | R3 | FUTURE_DOMAIN | human + four-eyes | recovery workflow |
| Refund/entitlement/coupon override | R2/R3 | FUTURE_DOMAIN | policy-dependent | Finance system of record |
| Export/delete/legal hold | R3 | FUTURE_DOMAIN | human + four-eyes | Privacy workflow |
| Bulk, staff role, rollout/config | R3 | FUTURE_DOMAIN | human/approved CI | blast-radius and independent approval |

ב־request_guardian_reinstall וב־child-install resend, ה־backend יוצר ושולח
challenge, activation URL או OTP out-of-band לערוץ המאושר. הערך עצמו לעולם
אינו מוחזר ל־Staff UI, Agent tool או prompt.

עבור מערכת חיצונית, לא ניתן לכתוב “הפעולה ו־Audit אטומיים” כאילו WhatsApp
או מכשיר הם אותה transaction. ה־Action Request, Audit ו־transactional outbox
נכתבים אטומית; intent, dispatch, provider/device acknowledgment, result
ו־verification נרשמים כאירועים נפרדים.

פעולה הרסנית משתמשת, כאשר הדין והמוצר מאפשרים, בשני שלבים: request מאושר
עם חלון ביטול ולאחריו execution. כאשר rollback אמיתי אינו אפשרי, נדרשים
recovery path או compensating controls מפורשים; אין להבטיח “undo” שאינו קיים.

## 12. הרשאות בני אדם ואייג׳נטים

### 12.1 תפקידי צוות

| תפקיד | תחום |
| --- | --- |
| CEO / Executive Admin | כל התחומים והמדדים, approvals ו־drill-down מאודט |
| Platform Super Admin | IAM, תשתית, releases ו־security operations |
| Support Manager | כל תורי השירות, SLA, assignment ו־diagnostics |
| Support Agent | תיקים מוקצים, PII ממוסך ופעולות R0–R1 |
| Device Support / Ops | מכשירים, versions, health ופעולות R2 מאושרות |
| Finance | billing identity, ledger, invoices, refunds ו־coupons |
| Trust & Safety | parent-safe incidents ו־case workflow |
| Privacy / DPO | consent, retention, DSAR, legal hold ו־access review |
| Security / SRE | platform health, incidents, access ו־containment |
| Growth / Product / Data | aggregate או pseudonymized בלבד |
| Auditor | read-only audit ו־snapshots |

מנכ״ל או Super Admin אינם מקבלים secret values, credentials, routine child
content או encrypted incident context.

### 12.2 הרשאת Front Office Agent

~~~text
effective permission =
channel service principal
AND verified customer scope
AND active conversation scope
AND case scope when a Case exists
AND agent tool allowlist
AND purpose
AND sensitivity policy
AND approval state
AND environment
AND time limit
~~~

### 12.3 הרשאת Internal Agent

~~~text
effective permission =
staff session permission
AND human delegation
AND active case scope
AND agent tool allowlist
AND purpose
AND sensitivity policy
AND approval state
AND environment
AND time limit
~~~

Agent אינו role עצמאי שמרחיב הרשאה. הוא אינו מאשר את עצמו, אינו מבצע bulk
בלי workflow ואינו מקבל service_role.

### 12.4 הרשאת Domain Specialist Agent

~~~text
effective permission =
domain service principal
AND signed task assignment
AND active case scope
AND domain tool allowlist
AND purpose
AND sensitivity policy
AND customer/staff verification requirements
AND approval state
AND environment
AND time limit
~~~

ה־Specialist אינו יורש את הרשאת ה־Front Office, ה־Copilot או ה־Agent ששלח
handoff. כל tool call עובר authorization מחדש.

## 13. Admin Control Plane נדרש

שמות הישויות הבאים הם conceptual ולא סכמת migration מאושרת:

- v2_staff_profiles;
- v2_staff_role_assignments;
- v2_staff_permissions;
- v2_agent_identities;
- v2_agent_versions;
- v2_agent_delegations;
- v2_support_contacts;
- v2_support_channel_identities;
- v2_support_conversations;
- v2_support_messages;
- v2_admin_cases;
- v2_admin_case_events;
- v2_admin_case_participants;
- v2_agent_runs;
- v2_agent_handoffs;
- v2_admin_action_requests;
- v2_admin_approvals;
- v2_admin_access_events;
- v2_knowledge_documents;
- v2_knowledge_candidates;
- v2_evaluation_suites;
- v2_evaluation_runs.

בנוסף נדרשים:

- staff-safe read models;
- field-level masking;
- Staff RPCs או Edge Functions לכל פעולה;
- Policy and Approval Engine;
- immutable audit projection;
- action verification workers;
- retention and legal-hold workers;
- per-tool agent kill switches.

v2_audit_events הקיים דורש הרחבה או projection חדש עבור:

- human actor, agent, sponsor ו־approver;
- role/permission snapshot;
- case, purpose ו־ticket;
- requested action לעומת executed action;
- sensitive fields שנקראו;
- policy decision ו־deny reason;
- step-up assurance, Guardian approval ו־approval IDs/timestamps;
- before/after digest ו־revision;
- correlation, trace ו־idempotency IDs;
- session, IP/device metadata ו־environment;
- intent, dispatch, acknowledgment, result ו־failure code;
- model, prompt, tool and knowledge versions;
- retention class ו־legal hold.

נדרש Audit Writer יחיד עם append-only enforcement והרשאות שמונעות update/delete
במסלול רגיל. נרשמים גם sensitive reads, reveal, denial ו־failure, ללא הערכים
הרגישים עצמם. פעולת DB פנימית נרשמת באותה transaction; פעולה חיצונית משתמשת
ב־transactional outbox ובאירועי attempt/result/verification נפרדים.

## 14. זיכרון, ידע ולמידה

### 14.1 שכבות זיכרון

1. Turn memory — זמני לשיחה.
2. Case memory — facts, evidence references, actions ו־outcome של Case אחד.
3. Customer operational memory — מידע תפעולי מינימלי והיסטוריית פתרונות.
4. Organizational knowledge — runbooks, policies, product contracts ותבניות מאושרות.
5. Learning dataset — dataset נפרד, de-identified ומאושר ל־evaluation או training.

שיחת השירות עם ההורה יכולה להישמר לפי retention מאושר. היא אינה תוכן
WhatsApp המנוטר של הילד.

כל זיכרון מקבל owner, purpose, sensitivity, retention, deletion behavior,
version ו־provenance. Summary של אדם או אייג׳נט אינו הופך אוטומטית לעובדה.

### 14.2 מחזור למידה

~~~text
Eligible production feedback
  -> eligibility + legal-basis gate
  -> Knowledge Candidate
  -> eligibility + de-identification review
  -> human labeling/adjudication
  -> offline evaluation + hidden holdout
  -> change proposal
  -> Product/Safety/Privacy/Engineering approval
  -> versioned release
  -> shadow
  -> canary
  -> gradual rollout
  -> monitoring / rollback
~~~

כל run רושם:

- agent/model/prompt/policy/tool/knowledge/eval versions;
- evidence שנקרא;
- tools שנקראו;
- action proposed/executed;
- confidence ו־uncertainty reasons;
- latency, cost ו־result;
- human correction;
- postcondition verification.

נשמר concise decision summary שניתן לביקורת, ולא private chain-of-thought.
Prompt או completion מלאים אינם נשמרים אוטומטית; retention ו־redaction שלהם
דורשים חוזה מפורש.

לא כל Case זכאי ללמידה. eligibility בודק purpose, legal basis, consent כאשר
נדרש, privacy class, retention, age/minor risk, de-identification ו־exclusion
של child safety content. Dataset item, label, adjudication, change proposal,
approval ו־release הם artifacts versioned עם lineage. מחיקה או תיקון במקור
מפעילים deletion/correction propagation לכל dataset או index שאושר.

אסור לאייג׳נט:

- לשנות prompt או policy בפרודקשן;
- ליצור או להפעיל כלי;
- לשנות threshold או RBAC;
- להפוך feedback ל־ground truth ללא review;
- לבצע self-training או deploy;
- להאריך retention;
- להעתיק מידע ילד רגיש ל־memory או vector index כללי.

## 15. Human Takeover

Takeover מופעל כאשר:

- הלקוח מבקש אדם;
- confidence נמוך או הכוונה מרובת תחומים;
- מספר ניסיונות פתרון עבר threshold versioned שנקבע אחרי baseline;
- יש identity mismatch;
- sentiment signal יחד עם תלונה, בקשת אדם או evidence נוסף; sentiment לבדו
  אינו החלטה;
- Safety, Security, Privacy, Legal או פעולה כספית;
- נדרשת R2 שסומנה human-required או כל R3;
- SLA בסיכון;
- tool/source unavailable.

State machine:

~~~text
AI_ACTIVE
  -> TAKEOVER_REQUESTED
  -> WAITING_FOR_HUMAN
  -> LEASE_OFFERED
  -> HUMAN_ASSIGNED
  -> HUMAN_ACTIVE
  -> WAITING_CUSTOMER / WAITING_INTERNAL
  -> RESOLVED
  -> AUTOMATION_FOLLOWUP_ALLOWED, אם policy מאשרת

Alternatives:
LEASE_REJECTED / LEASE_EXPIRED / NO_HUMAN_AVAILABLE / SUPERVISOR_OVERRIDE
~~~

עם human assignment:

- האייג׳נט מפסיק תשובות חיצוניות;
- העובד מקבל summary, evidence, confidence, verification ופעולות שכבר בוצעו;
- conversation lease נרכש אטומית, מתחדש, פג ומשתחרר עם owner history;
- transfer הוא warm handoff עם owner history וסיבה;
- חזרה לאוטומציה מתרחשת רק לפי policy או החלטה אנושית.

מחוץ לשעות או כאשר אין נציג, הלקוח מקבל ציפייה אמיתית לזמן מענה; Case נשאר
WAITING_FOR_HUMAN, escalates לפי priority ואינו מוחזר אוטומטית ל־AI אם התחום
מחייב אדם. רק WAITING_FOR_CUSTOMER יכול לעצור resolution SLA, בכפוף למדיניות
שתאושר.

בדיקות חובה כוללות race על lease, expiry, transfer rejection, supervisor
override, agent crash, reply שנשלח בזמן takeover ואי־זמינות אנושית.

## 16. Control Tower UI

### 16.1 Company Inbox

- שמאל: queues, conversations, verification, priority ו־SLA.
- מרכז: השיחה, attachments, composer ו־human takeover.
- ימין: Customer 360, diagnostics, timeline ו־allowed actions.
- RTL מלא, keyboard navigation ו־screen-reader support.

מצבים:

- new/unread;
- unverified או ambiguous identity;
- AI active;
- handoff pending;
- human active;
- waiting customer/data/approval;
- SLA at risk/breached;
- sensitive או escalated;
- delivery failed;
- attachment scanning/blocked;
- source unavailable;
- resolved/closed/reopened.

### 16.2 Customer 360

- snapshot ברור בזמן;
- no match/multiple match/no child/no device;
- install pending/expired/consumed;
- device protected/degraded/late/interrupted/recovering;
- permission missing/unknown/not supported;
- app update required;
- settings revision drift;
- command pending/failed/expired;
- data stale/partial;
- field redacted/permission denied.

### 16.3 CEO view

- אירועים פתוחים לפי domain, priority, owner ו־SLA;
- ממתין ללקוח, לאייג׳נט, לאישור או לאדם;
- חריגות ודפוסים חוזרים לפי OEM, version ו־reason code;
- agent quality, automation, override ו־cost;
- החלטות שמחכות לאישור;
- learning candidates ו־release status;
- drill-down מאודט, ללא secrets או routine child content.

## 17. מדדים

### 17.1 Invariants

- unauthorized actions: 0;
- approval bypasses: 0;
- cross-family exposure: 0;
- raw child content leakage: 0;
- duplicate external action from retry: 0;
- audited sensitive reads/actions: 100%;
- postcondition verification לפעולה שבוצעה: 100%;
- typed handoffs: 100%.

### 17.2 Service ו־Operations

- intent/routing accuracy;
- first response ו־time to triage;
- first-contact resolution;
- median/P95 resolution time;
- SLA breach;
- reopen ו־repeat-contact;
- activation, pairing ו־permission recovery;
- heartbeat recovery;
- human takeover ו־override rate;
- handoffs per case ו־handoff loop;
- tool success/retry/timeout;
- stale-data rate;
- CSAT;
- cost and latency per resolved case.

### 17.3 Agent quality

- evidence-backed factual accuracy;
- confidence calibration ו־overconfidence;
- unsupported claim rate;
- correction rate;
- policy violation rate;
- action proposal precision;
- resolution verified by system;
- performance per agent version ו־knowledge snapshot.

Thresholds מספריים ייקבעו אחרי shadow baseline. אין להמציא יעד רק כדי
להציג KPI ירוק.

## 18. תכנית מימוש

### Phase 0 — Discovery וחוזים

- Meta/Kippy 1 discovery;
- freeze של Case, Event, Agent, Handoff ו־Action contracts;
- staff role/permission matrix;
- R2/R3 approval matrix;
- support-message retention;
- human coverage ו־SLA;
- knowledge and evaluation policy.

### Phase 1 — Control Plane לקריאה בלבד

- Staff IAM, MFA ו־environment separation;
- staff/agent identities;
- immutable audit;
- safe V2 read models;
- Customer 360 לקריאה בלבד;
- Company Inbox ו־Cases;
- manual human operation;
- agents ב־shadow בלבד.

### Phase 2 — AI Front Office

- customer-facing disclosure;
- identity/verification;
- classification, routing ו־summaries;
- approved FAQ/templates;
- Front Office ו־Case Workflow Service;
- human takeover;
- R0/R1 בלבד.

### Phase 3 — Service ו־Device Actions

- action gateway;
- install/OTP workflows;
- REPORT_HEARTBEAT ו־REFRESH_SETTINGS;
- postcondition verification;
- R2 approval ו־rate limits;
- OEM repair knowledge.

### Phase 4 — Sensitive workflows

- R3, step-up, Guardian approval ו־four-eyes;
- locate/ring/lost mode only after explicit policy;
- privacy, finance, safety and security workflows;
- access review ו־legal hold.

### Phase 5 — Company-wide agents

- Finance, Growth, Privacy, Safety, Release ו־Executive agents;
- budgets and system-of-record integrations;
- controlled optimization and advanced automation.

### Phase gates מחייבים

- Phase 1 מתחיל עם fixtures ו־V2 Staging בלבד. אין production Customer 360
  ואין mutation.
- Live Customer 360 דורש Guardian PWA/Auth/API cutover ל־V2 ו־Staff-safe
  projections מאומתים; עצם קיום הטבלאות אינו מספיק.
- Front Office חיצוני דורש Meta discovery, channel security, retention,
  model/privacy approval ו־shadow evaluation.
- R2 דורש Action Gateway, Staff API, device/Android integration והוכחת
  postcondition ב־Staging.
- R3 ו־כל production mutation חסומים עד מעבר מלא של terminal gate L4
  במסמך kippy-v2-end-to-end-integration.md, וכן approval policy ספציפית.
- “Backend deployed” אינו שווה Android/PWA end-to-end ואינו פותח פעולה.

אין להתחיל writer lanes של schema/backend/UI/agent runtime לפני ש־Phase 0
אושר. בעת פיצול העבודה יוגדר כותב יחיד לכל path, בעלים לכל shared contract
ו־integration owner אחד.

## 19. קריטריוני קבלה ראשוניים

סעיף זה הוא PROPOSED. לפני מימוש כל סעיף יומר ל־Given/When/Then עם actor,
environment, preconditions, fixture, measurable result ו־required audit.

### Channel

- webhook retry אינו יוצר message, Case או reply כפולים.
- status update אינו נוצר כהודעה חדשה.
- attachment חסום עד scan.
- outage יוצר retry ו־alert, לא אובדן שקט.
- אין שימוש בנתיב WhatsApp לא רשמי.

### Identity

- phone match לבדו אינו אימות.
- מידע אישי אינו נחשף ב־V0/V1.
- verification token חד־פעמי, scoped ו־expiring.
- ambiguous identity מועבר לאדם.
- support challenge value, child_install_otp, activation token ו־session/access
  token אינם נרשמים ב־message, Case, prompt או audit metadata.
- child_install_otp נדחה אם מנסים להשתמש בו כ־support verification.

### Service 360

- כל שדה כולל source, timestamps, freshness, sensitivity ו־redaction.
- אין V1 או direct table access.
- stale/partial data אינם מוצגים כ־healthy.
- expected/applied revision מוצגים בנפרד.
- אין secrets, routine child WhatsApp או encrypted incident context.

### Actions

- כל פעולה דרך staff action gateway בלבד.
- schema, scope, permission, purpose, idempotency, TTL ו־rate limit נבדקים.
- retry אינו מבצע side effect נוסף.
- failure נשמר עם reason code.
- Action Request, Audit ו־outbox נכתבים אטומית; dispatch/result/verification
  נרשמים בנפרד.
- terminal state מאומת דרך read path נפרד.
- R3 אינו מתקדם בלי approvals תקפים.

### Agents

- אין כלי production לפני eval ו־shadow.
- inbound text ו־attachments נחשבים untrusted ולא tool instructions.
- low confidence/high impact עובר לאדם.
- אין agent self-approval או privilege expansion.
- כל run versioned ו־audited.
- kill switch נפרד לכל agent tool.

### Human takeover

- האייג׳נט מפסיק לענות לאחר assignment.
- אין double reply.
- האדם מקבל warm summary עם evidence ו־uncertainty.
- owner history ו־reason נשמרים.
- lease expiry, rejection, crash ו־no-human-available אינם מחזירים תשובה
  אוטומטית בלי transition מורשה.

### Privacy

- L1 אינו רואה exact location, safety או billing details.
- Finance אינו רואה child content או location.
- CEO אינו מקבל secrets.
- sensitive reveal הוא JIT, purpose-bound ומתועד.
- raw child WhatsApp אינו נכנס ל־support, memory, prompts או exports.

### תרחישי E2E חובה

1. Prospect לא מזוהה שואל מחיר.
2. Guardian מאומת נכשל ב־QR או OTP.
3. Samsung/Xiaomi עם permission degradation ו־monitoring interrupted.
4. מספר משותף שמתאים לשני Guardians.
5. webhook retry והודעת outbound ללא כפילות.
6. REPORT_HEARTBEAT שמסתיים success או failure ומאומת.
7. Support Agent מנסה לצפות במיקום ונחסם.
8. הלקוח מבקש אדם ונוצר takeover ללא double reply.
9. פנייה בטיחותית מוסלמת ואינה נסגרת אוטומטית.
10. פעולה R3 נחסמת ללא step-up ואישור נוסף.
11. stale backend מוצג כ־unknown ולא כ־healthy.
12. Case נפתח מחדש ושומר את ההיסטוריה וה־root cause המקורי.
13. child_install_otp אינו מתקבל כ־support verification.
14. cross-family, minor caller ו־field masking יוצרים denial מאודט.
15. approval פג או mismatched action hash חוסם dispatch.
16. crash אחרי outbox commit אינו יוצר side effect כפול.
17. retention purge מכבד legal hold ומפיץ מחיקה ל־learning artifacts זכאים.
18. Human lease פג או נדחה בלי double reply ובלי Case יתום.

## 20. Stop Conditions

אדם או אייג׳נט עוצרים ומתעדים denial כאשר:

1. אין actor identity, Conversation, purpose או permission תקפים, או שחסרים
   Case/verification כאשר הפעולה דורשת אותם.
2. המשאב מחוץ למשפחה, לילד, למכשיר או לתיק.
3. השדה או הפעולה אינם allowlisted.
4. נדרש V1, service_role, secret או raw incident context.
5. verification, step-up או approval חסרים או פגו.
6. approver זהה ליוזם או ל־sponsor כאשר נדרש four-eyes.
7. freshness אינו מספיק לפעולה.
8. expected revision השתנה.
9. אין idempotency, TTL, rate limit או atomic audit/outbox write.
10. הפעולה בלתי הפיכה בלי recovery path.
11. source/tool נכשל לאחר retries מוגבלים.
12. נדרש bulk ללא blast-radius ו־approval.
13. האירוע safety אינו parent-safe/confirmed.
14. ה־Phase gate המפורש בסעיף 18 לא עבר.

אין fallback ישיר ל־DB ואין “ננסה בכל זאת”.

## 21. החלטות פתוחות ל־Phase 0

1. אימות טכני מלא של מצב Kippy 1 ו־Meta.
2. שעות שירות אנושיות וכוננות S0/S1.
3. SLA לפי priority ושעות פעילות.
4. retention לשיחות שירות, attachments, diagnostics ו־audit.
5. שפות נתמכות מעבר לעברית.
6. פרסונת השיחה, שם האייג׳נט וטון מותג.
7. תדירות follow-up ו־auto-close לאחר חוסר תגובה.
8. מטריצת approvals מדויקת ל־R2/R3.
9. מדיניות מיקום, ring, lost mode ו־parental changes דרך שירות.
10. מדיניות emergency escalation ו־mandatory reporting.
11. ספק מודל, ZDR, data residency ו־egress לשיחות שירות.
12. owner ואישור של Knowledge Candidates.
13. תקופות shadow/canary ויעדי quality לאחר baseline.
14. האם ה־Case system נשאר native או מתחבר בעתיד ל־CRM חיצוני.
15. Business Continuity וערוץ fallback במקרה WhatsApp/Meta outage.

## 22. מקורות קנוניים

- docs/parental-controls/PARENTAL_CONTROLS_V2_SOURCE_OF_TRUTH.md
- C:\tmp\KippySafetyCore-v2\docs\kippy-v2-end-to-end-integration.md
- C:\tmp\KippySafetyCore-v2\docs\child-installation-v2-source-of-truth.md
- C:\tmp\KippySafetyCore-v2\docs\KIPPY_SAFETY_ARCHITECTURE_V2.md
- Meta WhatsApp Business Platform collection:
  https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- Meta WhatsApp Business Platform webhooks:
  https://www.postman.com/meta/whatsapp-business-platform/folder/lboq68h/webhooks

במקרה של סתירה:

1. חוזי הבטיחות, הפרטיות והזהות של V2 גוברים על נוחות אדמין.
2. מסמך האינטגרציה של V2 גובר על donor code ב־PWA.
3. מסמך זה גובר על האדמין הישן בכל הנוגע ל־Staff, Cases ו־Agents.
4. שינוי החלטה שאושרה מתועד כ־Decision חדש; אין overwrite שקט.

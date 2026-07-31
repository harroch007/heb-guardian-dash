# פרומפט Handoff לסוכן Android — מיזוג תשתית הודעות קוליות

מסמך זה מיועד להדבקה כפי שהוא בצ׳אט **„סקור את הקוד”**.
המשימה הראשונה של הסוכן היא לבצע audit של הקוד הקיים וליצור מסמך אינטגרציה קנוני. אין להתחיל לממש את הפיצ׳ר לפני השלמת שני השלבים האלה.

---

## הפרומפט להדבקה

אתה הסוכן שמפתח וסוקר את אפליקציית Android של Kippy במכשיר הילד. אנחנו מתחילים כעת לשלב באפליקציה תשתית לטיפול בהודעות קוליות נכנסות של WhatsApp.

המטרה העסקית והטכנית היא:

1. לזהות הודעה קולית של WhatsApp שהגיעה למכשיר הילד ושעומדת בתנאי ההפעלה שהוגדרו.
2. לקרוא את קובץ האודיו המקומי ש־WhatsApp שמר במכשיר.
3. לפענח ולתמלל את האודיו **על מכשיר הילד בלבד**, באמצעות מנוע STT קטן ומקומי.
4. להכניס את התמלול לצינור הניתוח הקיים כאירוע טקסט רגיל.
5. לשמור metadata פנימי וברמת ההודעה שמבהיר שמקור הטקסט הוא הודעה קולית, בלי להוסיף prefix לתוכן הטקסט.
6. לא להעלות אודיו, URI מקומי, נתיב קובץ או buffer לשרת או לספק AI חיצוני.
7. לשלב את היכולת בתוך הארכיטקטורה, מנגנוני ה־feature flags, ה־telemetry וה־KPIs הקיימים — לא לבנות צינור מקביל ומנותק.

גבולות המוצר לגרסה הזו:

- המקור הוא WhatsApp בלבד; אין כרגע הודעות פנימיות ב־Kippy.
- discovery של קובץ יכול להתרחש בהגעתו, אך trigger התמלול הוא configurable בין `ON_OPEN` ל־`ON_ARRIVAL`; ברירת המחדל ל־PoC היא `ON_OPEN`.
- הודעות קוליות מסוג View Once אינן נתמכות ב־v1.
- זכאות לניטור הטקסט וזכאות להרחבת הקול הן שתי תוצאות נפרדות. כשל ביכולת הקול אינו חוסם מכשיר שתומך במוצר הטקסט הבסיסי.
- מיד לאחר חיבור המכשיר וקבלת ה־device profile, ולפני הורדת מודל קולי או הפעלת voice workers, יש לקבל החלטת Voice Device Eligibility. יכולת קול לא מתאימה נחסמת מראש וההורה מקבל הודעה ברורה; אין “נפעיל ונראה אם יקרוס”.
- אין להחליש את תנאי הפרטיות או האמינות כדי לתמוך בכל מכשיר.
- אין לבנות כעת חבילות, תמחור, רכישה או entitlement. הארכיטקטורה רק צריכה להפריד בין יכולת טכנית לבין בחירת מוצר עתידית.

### מקור האמת המחייב

לפני כל פעולה, קרא את המסמך הקנוני במלואו:

- נתיב מוחלט:
  `C:\Users\Racheli\Documents\kippy\docs\voice-messages\README.md`
- נתיב יחסי במאגר Kippy הנוכחי:
  `docs/voice-messages/README.md`

המסמך הזה הוא מקור האמת למוצר, לארכיטקטורה, לפרטיות, ל־device gating, ל־rollout ולתנאי הקבלה של תשתית ההודעות הקוליות. החלטה או הנחה בשיחה קודמת אינן גוברות עליו. אם הקוד הקיים סותר אותו, אין לשנות בשקט את המסמך או את הקוד: יש לתעד את הסתירה, את ההשלכות ואת ההמלצה.

### סדר העבודה המחייב

במשימה הנוכחית עליך לבצע, לפי הסדר:

1. **Audit לקריאה בלבד של הקוד הקיים.**
2. **מיפוי נקודות השילוב המדויקות והפערים.**
3. **יצירת מסמך אינטגרציה קנוני שמסתנכרן עם ה־KPIs הקיימים.**
4. **הצגת הממצאים ותכנית ה־PR הראשון.**

אין להתחיל לכתוב את קוד הפיצ׳ר, לשנות schema, להוסיף dependency, לשנות הרשאות או לערוך migration לפני שה־audit ומסמך האינטגרציה הושלמו והוצגו. מסמך האינטגרציה חייב להתבסס על ראיות מהקוד בפועל, לא על ארכיטקטורה משוערת.

## שלב 0 — אימות סביבת העבודה

לפני ה־audit:

- קרא את כל הוראות המאגר הרלוונטיות, לרבות `AGENTS.md`, מסמכי architecture ו־README מקומיים אם הם קיימים.
- תעד:
  - שורש המאגר שבו נמצאת אפליקציית Android;
  - שם המודול או המודולים של אפליקציית הילד;
  - branch נוכחי;
  - commit/HEAD נוכחי;
  - `git status`;
  - שינויים לא שמורים או עבודה קיימת שאסור לדרוס.
- אם קוד Android נמצא במאגר או worktree אחר ממסמך מקור האמת, תעד את שני הנתיבים ואת ה־commit של כל אחד מהם.
- אם אינך מוצא בפועל פרויקט Android עם Gradle, Manifest וקוד Kotlin/Java, עצור. אל תייצר אפליקציית Android חדשה בתוך מאגר ה־web/backend ואל תנחש את המבנה. דווח איזה מאגר או worktree חסר.

## שלב 1 — Audit לקריאה בלבד

מטרת ה־audit היא להוכיח איפה התשתית החדשה משתלבת במסלול הקיים מקצה לקצה. לכל ממצא צרף:

- נתיב קובץ מדויק;
- class/function/symbol;
- מספר שורה או טווח קצר כאשר הדבר אפשרי;
- סטטוס: `CONFIRMED`, `PARTIAL`, `MISSING`, `ASSUMPTION`, `DECISION_REQUIRED` או `BLOCKER`.

אל תסתפק בתיאור כללי כמו „נוסיף service” או „נחבר ל־pipeline”. מצא את נקודת החיבור הקיימת בפועל.

### 1.1 מבנה אפליקציית Android

מפה:

- `minSdk`, `targetSdk`, `compileSdk`;
- flavor/build types;
- ABI נתמכים, כולל מצב 32/64-bit;
- שיטת DI;
- מבנה modules/layers;
- persistence מקומי;
- scheduler, WorkManager ו־foreground services;
- מנגנון feature flags/config;
- logging, crash reporting ו־analytics;
- build של native code, אם קיים;
- מנגנון הורדה, אחסון, אימות וגרסאות של מודלים מקומיים, אם קיים;
- conventions קיימים לבדיקות unit, integration, instrumentation ו־device tests.

### 1.2 זיהוי אירועי WhatsApp

אתר את המסלול המדויק שבו Kippy מזהה כיום הודעת WhatsApp או פעילות בצ׳אט:

- `AccessibilityService`;
- `NotificationListenerService`;
- parser של WhatsApp;
- זיהוי conversation/contact/chat type;
- event deduplication;
- timestamp והקשר של הודעות סמוכות;
- זיהוי פתיחה, צפייה או play, אם קיים;
- מגבלות OEM, background ו־reboot.

יש להבחין בין שלושה דברים שונים:

1. ידיעה שב־UI קיימת בועת voice note;
2. inference שההודעה נפתחה או הופעלה;
3. גישה מוכחת לבתים של קובץ האודיו.

Accessibility או notification metadata לבדם אינם הוכחה שיש גישה לאודיו.

### 1.3 גישה לקובץ האודיו

אתר האם כבר קיים שימוש ב־:

- Storage Access Framework;
- persistable URI permission;
- `DocumentFile`;
- `ContentResolver`;
- MediaStore;
- file observers או periodic scan;
- cache/index מקומי של artifacts.

המסלול המתוכנן הוא הרשאת SAF מצומצמת לתיקיית `WhatsApp Voice Notes`, עם MediaStore כאפשרות משלימה בלבד אם הקוד והגרסאות הנתמכות מצדיקים זאת.

בדוק ותעד:

- האם ניתן לבחור ולשמר הרשאה לתיקייה בפועל בגרסאות Android הנתמכות;
- וריאציות נתיבי WhatsApp בין גרסאות Android/WhatsApp;
- WhatsApp רגיל לעומת Business, Dual Apps, Work Profile ו־cloned apps;
- קובץ חלקי לעומת קובץ יציב ומוכן לקריאה;
- filename, MIME, header אמיתי, codec ומשך;
- מחיקה, העברה, View Once ו־low storage;
- reboot וביטול הרשאה.

אין להכניס למסלול המוצע:

- הקלטה מהמיקרופון;
- הקלטת רמקול;
- `MediaProjection`;
- `AudioPlaybackCapture`;
- root;
- קריאת database פרטי של WhatsApp;
- `MANAGE_EXTERNAL_STORAGE`;
- הרשאה רחבה שאינה נדרשת למסלול מוכח.

### 1.4 Correlation בין קובץ לבועת הודעה

מצא את מודל ההודעה הפנימי ואת המידע שכבר נשמר לגבי כל הודעה. תכנן נקודת שילוב שמאפשרת לשייך artifact מקומי להודעת WhatsApp המתאימה.

מפה אילו אותות קיימים:

- conversation/chat identity;
- sender direction;
- event timestamp;
- artifact modification/creation time;
- order בתוך הצ׳אט;
- duration;
- filename/path metadata;
- UI metadata;
- replay או אירוע כפול.

הכלל המחייב הוא fail-closed:

- התאמה ודאית או מעל סף שהוגדר ומתועד — ניתן להמשיך;
- יותר ממועמד סביר אחד — `AMBIGUOUS`, אין תמלול שנכנס לצינור;
- אין מועמד — `NOT_FOUND`, אין ניחוש.

יעד האיכות הקריטי הוא **אפס שיוכים שגויים**. עדיף לדלג על הודעה מאשר לשייך תמלול לילד, שולח או שיחה לא נכונים.

### 1.5 צינור ההודעות וה־backend

מצא בקוד Android את:

- מודל ההודעה הנכנסת;
- נקודת normalizing;
- בניית חלון/stack של כמה הודעות;
- פעולת flattening לטקסט אחד;
- offline/retry queue;
- network client;
- serializer;
- הקריאה ל־`create_alert`;
- יצירת `client_event_id`;
- idempotency ו־deduplication.

במאגר Kippy הנוכחי בדוק במפורש את:

- `supabase/migrations/20260410123022_cf1ca8a2-5f10-4a22-a37b-270aea6225be.sql`
- `supabase/migrations/20260515075406_76c5d45e-0033-4b36-91ae-3244eadc91e2.sql`
- `supabase/migrations/20260113113801_4935fac5-7a22-4fca-8743-8e027d78764a.sql`
- `supabase/functions/analyze-alert/index.ts`

אמת ותעד:

- `p_message` נכתב ל־`alerts.content`;
- `p_source` משמש בפועל כ־sender בגרסת ה־RPC הקיימת, ולכן אינו marker מתאים למקור קולי;
- המיפוי וההתנהגות בפועל של `p_message_count`, `p_platform`, `p_client_event_id`, `p_device_id`, `p_chat_type` ו־`p_is_processed`;
- האם `p_contact_hash` ו־`p_pii_redacted_count` מתקבלים ונשמרים בפועל;
- idempotency נשענת על `(device_id, client_event_id, platform)`;
- ה־backend הנוכחי משטח חלון של הודעות ל־`alerts.content`;
- דגל ברמת alert אינו מספיק לחלון מעורב שמכיל טקסט והודעות קוליות.
- האם `alert_events_queue` ו־`claim_alert_events` אכן מוגדרים במיגרציה זמינה, ולא רק בקוד או ב־generated types.

אין להשתמש לציון מקור קולי ב־:

- prefix בתוך התמלול;
- `category`;
- `source`;
- `sender`;
- `client_event_id`;
- שינוי מלאכותי של `message_type` ברמת ה־alert.

החוזה הרצוי ברמת ההודעה הוא טקסט רגיל עם metadata מפורש, לדוגמה:

```text
message_type = "text"
source_kind = "voice_transcript"
```

עליך להוכיח כיצד metadata ברמת הודעה נשמר גם כאשר מספר הודעות הופכות לחלון אחד. אם הסכמה או ה־RPC אינם יכולים לשמור זאת, תכנן שינוי forward-compatible כגון payload מובנה או `message_segments`; אל תערוך migration היסטורי ואל תיישם את שינוי הסכמה בשלב ה־audit.

### 1.6 מנוע התמלול המקומי

מצא נקודת extension קיימת למנועי AI/ML מקומיים. אם אין כזו, תכנן abstraction מינימלי בבעלות האפליקציה, בלי לקשור את ה־pipeline לספק אחד.

הפרד לפחות בין:

- `VoiceArtifactCatalog` או רכיב מקביל לגילוי artifacts;
- `VoiceCorrelationResolver`;
- `VoiceAudioDecoder`;
- `LocalTranscriber`;
- adapter של מנוע STT;
- router לפי יכולת המכשיר;
- `VoiceTranscriptNormalizer`;
- telemetry/health reporter.

דרישות הליבה:

- input דרך URI/file descriptor נגיש;
- פענוח Ogg/Opus ל־PCM mono 16 kHz או לפורמט שהמנוע המאושר דורש;
- תמלול headless ברקע, בלי תלות במיקרופון או UI פעיל;
- מודל multilingual שתומך בעברית;
- אין fallback לענן;
- אין fallback סמוי ל־Android `SpeechRecognizer`;
- אין dependency ל־ML Kit GenAI Speech Recognition בליבת production;
- model version, checksum, התקנה אטומית ו־rollback;
- ניקוי קבצים זמניים ו־buffers לאחר העיבוד.

המועמד הראשון לבחינת PoC הוא adapter ל־`whisper.cpp` עם Tiny multilingual quantized; Base multilingual הוא מועמד benchmark למכשירים חזקים יותר. זו אינה הרשאה להכניס dependency מיד: תחילה בדוק התאמה ל־ABI, RAM, גודל APK/model, licensing, build conventions וביצועים במכשירים הנתמכים.

### 1.7 הרשאות, onboarding ושקיפות

מפה את:

- Manifest;
- service XML;
- runtime permission checks;
- parent setup flow;
- חיווי קבוע במכשיר הילד;
- capability checks;
- התנהגות לאחר ביטול הרשאה;
- battery optimization;
- background restrictions של OEM;
- reboot recovery.

מפה בנוסף את מסלול חיבור המכשיר הקיים מקצה לקצה:

- איזה payload של manufacturer/model ונתוני יכולת נשלח בסיום ה־pairing;
- מי מפיק אותו ומי שומר אותו;
- האם כבר קיים service או policy של device eligibility;
- באיזה מסך באפליקציית ההורה מוצגת תוצאת החיבור;
- מתי מתחילים model download, workers ושירותי הרקע;
- כיצד חוסמים אותם לפני activation;
- כיצד מתבצעת בדיקה חוזרת לאחר שינוי app/OS/model/policy או לאחר פינוי אחסון.

תכנן eligibility בשתי שכבות שמשתלבות במנגנון הקיים ולא יוצרות source of truth מקביל:

- `core_text_supported` — זכאות המכשיר לשירות ניטור הטקסט הבסיסי;
- `voice_supported` — זכאות נפרדת להרחבת הקול.

כשל ב־`voice_supported` לעולם אינו הופך `core_text_supported=true` ל־false ואינו חוסם את צינור הטקסט.
השמות כאן מייצגים semantics מחייבים, לא הוראה להוסיף שדות בשם הזה. תחילה מצא את המודל והחוזה הקיימים והשתלב בהם.

עבור Voice Device Eligibility Preflight:

1. static precheck על manufacturer/model, Android API, ABI, RAM, storage, app version וגרסת המנוע/מודל;
2. policy קנונית ובעלת `voice_eligibility_policy_version`;
3. bounded local probe עבור דגם לא מוכר או תוצאה גבולית, על sample קבוע שאינו תוכן של הילד;
4. מצבים מפורשים: `ELIGIBLE`, `UNSUPPORTED_PERMANENT`, `UNSUPPORTED_TEMPORARY`, `CAPABILITY_TEST_REQUIRED`;
5. `voice_supported=false` ו־fail-closed בכל מצב שאינו `ELIGIBLE`;
6. אין voice model download, voice worker או voice processing לפני eligibility חיובי;
7. הודעת הורה שמבדילה בין תנאי קבוע לזמני ומציעה להמשיך עם ניטור טקסט בלבד.

שם הדגם לבדו אינו מספיק להחלטה, משום שלאותו דגם עשויות להיות וריאציות RAM, ABI וגרסת Android. מנגד, דגם שאינו מוכר אינו מקבל אישור אוטומטי ואינו נדחה אוטומטית: הוא עובר probe תחום ובטוח. אין לאסוף serial, IMEI או identifier חדש לצורך הבדיקה.

החלטת המוצר כבר נקבעה: תוצאת Voice Eligibility שלילית **אינה** עוצרת activation של ניטור הטקסט כאשר Core/Text Eligibility חיובית. ההורה יכול להמשיך עם המוצר הבסיסי, או לבחור בעתיד במוצר המורחב באמצעות מכשיר מתאים.

אל תבנה כעת package selection, billing או entitlement. במסמך האינטגרציה תכנן רק separation of concerns שמאפשר בעתיד להוסיף `voice_entitled` או `selected_product_tier` בלי לשנות את משמעות `voice_supported`.

הפרד בין:

- הרשאת OS אמיתית שההורה העניק;
- preference מקומי;
- flag מהשרת;
- capability שנמדדה במכשיר.

אל תוסיף permission על בסיס השערה. אם היכולת דורשת permission חדש או מנגנון שאינו מופיע במסמך הקנוני, סמן זאת `DECISION_REQUIRED`.

### 1.8 פרטיות ואבטחה

בדוק מקצה לקצה:

- מה נכנס ל־logs;
- מה נכנס ל־crash reports;
- מה נכנס ל־analytics/telemetry;
- מה נשלח ברשת;
- מה נשמר מקומית;
- מה נכנס ל־backup;
- מה נשמר ב־backend לאחר הניתוח.

בדוק במיוחד:

- log ב־`analyze-alert/index.ts` שעלול להדפיס את 200 התווים הראשונים;
- `training_dataset.raw_text`;
- מועד מחיקת `alerts.content`;
- האם תמלול קולי נשמר או משמש ל־training.

ברירת המחדל למסמך האינטגרציה:

- אודיו לעולם אינו יוצא מהמכשיר;
- telemetry אינה מכילה אודיו, תמלול, URI, path, שם איש קשר או raw exception;
- `failure_reason` הוא enum מסונן;
- אין שימוש בתמלולי קול ל־training עד החלטת מוצר/פרטיות מפורשת.

### 1.9 החרגה מפורשת

אל תחבר את הפיצ׳ר ל־Kippy internal chat מהגרסה האחרת. בפרט, אל תשתמש ב־:

- `chat_messages.message_type='voice'`;
- `chat-media`;
- `src/hooks/useChat.ts`;
- `src/pages/ChatRoomV2.tsx`;
- `src/pages/ChatV2.tsx`.

תשתיות אלה שייכות למוצר שיחה אחר ואינן צינור ניטור WhatsApp.

## שלב 2 — סנכרון מלא עם KPIs ו־telemetry

לפני שאתה מציע KPI חדש, מצא את מקורות האמת הקיימים בקוד Android וב־backend ואת הנוסחה בפועל של כל KPI.

מפה לפחות את:

- `device_daily_metrics.messages_scanned`;
- `device_daily_metrics.stacks_sent_to_ai`;
- `device_daily_metrics.alerts_sent`;
- `ai_stack_requests`;
- `ai_runtime_telemetry`;
- `ai_engine_health`;
- `device_ai_profiles.voice_supported`;
- `device_ai_profiles.selected_voice_engine`;
- `device_ai_profiles.device_tier`;
- `device_ai_profiles.last_failure_reason`;
- `ai_policy_config.feature_flags.enable_voice_transcription`;
- `ai_rollout_flags.enable_voice_transcription`;
- `ai_rollout_flags.disable_voice_on_low_end`;
- `report_ai_telemetry`;
- `upsert_ai_engine_health`.

עבור `report_ai_telemetry`, אמת את החוזה ואת השימוש ב־`engine_type`, `event_type`, `latency_ms`, `success`, `fallback_triggered`, `failure_reason` ו־`model_version`.
עבור `upsert_ai_engine_health`, אמת את `voice_engine_status`, `last_voice_latency_ms`, `voice_failure_count` ו־`last_failure_reason`. אין לשלוח באף אחד מהשדות האלה תוכן הודעה, תמלול, URI או exception גולמי.

הגדרת ההפעלה השמרנית שצריך לאמת ולממש בהמשך היא:

```text
voice_enabled =
  policy.feature_flags.enable_voice_transcription
  AND rollout.enable_voice_transcription
  AND device_ai_profiles.voice_supported
  AND NOT (
    rollout.disable_voice_on_low_end
    AND device_tier == "low"
  )
```

כל `false`, config חסר, config ישן או סתירה חייבים להסתיים ב־fail-closed.
נוסחה זו חוסמת את יכולת הקול בלבד. היא אינה רשאית לחסום או לשנות את צינור ניטור הטקסט. entitlement עתידי אינו חלק מהמימוש הנוכחי.

### כללי ספירה

- תמלול שנכנס לצינור ייספר בדיוק פעם אחת ב־`messages_scanned`.
- אם בועת ה־voice כבר נספרה לפני שהתמלול הושלם, אין לספור אותה שוב. יש לתעד במדויק מהו אירוע הספירה היחיד.
- retry של transcription, enqueue או `create_alert` לא ייצור KPI כפול ולא alert כפול.
- `p_client_event_id` חייב להיות דטרמיניסטי ויציב לאורך retries.
- metrics פנימיים של decode/STT שייכים ל־`ai_runtime_telemetry` ול־`ai_engine_health`; אין לשנות בשקט את משמעות ה־KPIs שההורה רואה.
- אין לשנות שם, נוסחה או semantics של KPI קיים בלי לתעד החלטה ומיגרציה.

### טבלת KPI מחייבת במסמך

לכל KPI או metric צור שורה עם העמודות:

| שדה | תוכן נדרש |
|---|---|
| KPI / metric | השם הקנוני |
| Product meaning | מה הוא אומר למוצר |
| Exact formula | מונה, מכנה, חלון זמן וכללי dedupe |
| Source event | האירוע היחיד שמעדכן אותו |
| Producer | class/function/RPC מדויק |
| Storage | טבלה/עמודה או מערכת telemetry |
| Dimensions | device tier, engine, model, language, app/OS version וכדומה |
| Target / gate | יעד מספרי או תנאי מעבר |
| Privacy class | מה אסור להיכלל |
| Consumer | dashboard, health, rollout או parent UI |
| Status | קיים, דורש הרחבה או חדש |

### KPIs ו־quality gates ראשוניים

המסמך צריך לכלול, לכל הפחות:

- **Voice eligibility decision coverage:** 100% מהמכשירים מקבלים verdict קולי לפני voice model download או הפעלת voice worker.
- **Voice eligibility false-accept rate:** יעד 0 למכשיר שסומן `ELIGIBLE` ולאחר מכן נכשל ב־OOM/ANR בגלל תנאי חומרה.
- **Pre-activation protection:** 0 הפעלות voice ו־0 הורדות מודל במצב שאינו `ELIGIBLE`.
- **Voice eligibility decision latency:** למדוד מרגע קבלת device profile ועד verdict; יעד מספרי ייקבע לאחר baseline.
- **Voice eligibility rejection breakdown:** שיעור לפי reason code מסונן, policy version ו־device tier, ללא identifier אישי.
- **Unknown-device rate:** שיעור `CAPABILITY_TEST_REQUIRED` והזמן עד verdict סופי.
- **Base-product preservation:** 100% מהמכשירים עם `core_text_supported=true` ממשיכים לניטור טקסט גם כאשר `voice_supported=false`.
- **False correlation rate:** יעד 0.
- **Artifact access gate:** לפחות 20/20 קבצי ליבה נגישים בכל combination מאושר של מכשיר/Android/WhatsApp.
- **Correlation gate:** לפחות 20/20 הודעות ליבה משויכות נכון בכל combination מאושר.
- **ASR latency:** `p95 RTF <= 1.0` עבור beta במכשירים שאושרו.
- **Reliability:** 0 crash, OOM או ANR בתרחישי הקבלה.
- **Privacy invariant:** 0 אודיו, URI, path או תמלול ב־telemetry, logs ו־network payload שאינו חוזה הטקסט המאושר.
- **WER/CER בעברית:** יעד סופי `TBD` עד ליצירת baseline על corpus מאושר; אין להמציא יעד לפני המדידה.
- **Duplicate rate:** 0 alerts ו־0 KPI increments כפולים כתוצאה מ־retry.
- **Text-pipeline regression:** כשל ב־voice לעולם אינו חוסם הודעות טקסט רגילות.

לכל KPI ציין כיצד מודדים אותו, על איזה device matrix, מי המקור ומתי הוא חוסם rollout.

## שלב 3 — יצירת מסמך האינטגרציה הקנוני

לאחר ה־audit, ולפני שינוי קוד, צור בתוך **מאגר אפליקציית Android בפועל**:

`docs/voice-messages/ANDROID_INTEGRATION_SOURCE_OF_TRUTH.md`

אם תיקיית docs מקבילה כבר קיימת, השתלב בקונבנציה הקיימת אך שמור את השם והקישור ברורים. קַשר מהמסמך החדש אל מסמך המוצר הקנוני, ועדכן את README המתאים במאגר Android כך שניתן יהיה למצוא אותו.

מסמך האינטגרציה יהיה מקור האמת למיזוג עם הקוד הקיים, ויכלול:

1. **Metadata**
   - בעלים;
   - סטטוס;
   - תאריך;
   - repo, branch ו־commit שנבדקו;
   - גרסת מסמך המוצר שעליה הוא נשען.
2. **Source precedence**
   - מסמך המוצר הקנוני;
   - מסמך האינטגרציה;
   - קוד ובדיקות;
   - decision log.
3. **Scope ו־non-goals**
4. **Current architecture**
   - תרשים וזרימה מקצה לקצה של המצב הנוכחי;
   - paths/symbols מדויקים.
5. **Exact integration seams**
   - איפה כל רכיב חדש נכנס;
   - איזה interface קיים מורחב;
   - איזה רכיב נשאר ללא שינוי.
6. **Gap and conflict analysis**
   - מה קיים;
   - מה חלקי;
   - מה חסר;
   - מה סותר את המסמך;
   - מה דורש החלטה.
7. **Target architecture**
   - discovery;
   - artifact catalog;
   - correlation;
   - decoder;
   - local transcriber/engine router;
   - normalizer;
   - queue/retry;
   - telemetry/health;
   - backend handoff.
8. **State machine**
   - מצבים, transitions, retry, terminal failure וניקוי.
9. **Data contracts**
   - מודל הודעה מקומי;
   - marker ברמת הודעה;
   - חלון מעורב;
   - payload ל־backend;
   - backward compatibility;
   - idempotency.
10. **Permissions and onboarding**
   - Device Eligibility Preflight מיד לאחר pairing;
   - תוצאות נפרדות ל־Core/Text ול־Voice;
   - parent capability UX שמציע להמשיך עם טקסט כאשר קול אינו נתמך;
   - versioned policy, reason codes ו־recheck flow;
   - extension point לחבילה עתידית, ללא מימוש billing או entitlement כעת;
11. **Background execution and OEM behavior**
12. **Dependency, native build and model distribution plan**
13. **Device capability matrix and gating**
14. **Feature flags and kill switch**
15. **KPI and telemetry mapping**
   - הטבלה המחייבת לעיל;
   - נוסחאות dedupe;
   - dashboard/rollout impact.
16. **Privacy and threat analysis**
17. **Test strategy**
   - unit;
   - integration;
   - instrumentation;
   - device matrix;
   - offline;
   - revoked permission;
   - low RAM/storage;
   - Hebrew/noise/long messages;
   - retry/reboot;
   - network privacy assertion.
18. **Rollout and rollback**
19. **File-by-file change plan**
   - path;
   - symbol;
   - שינוי מתוכנן;
   - dependency;
   - test.
20. **PR slicing**
   - PR קטן לכל gate;
   - dependency בין PRs;
   - תנאי כניסה ויציאה.
21. **Risks, assumptions, open decisions and blockers**
22. **Definition of Done**
23. **Decision log**

אין להעתיק למסמך תכנית גנרית. כל סעיף צריך להיות מותאם לארכיטקטורה שמצאת בפועל.

## שלב 4 — סדר המימוש העתידי

במסמך תכנן את המימוש לפי gates, בסדר הזה:

1. **Gate A — Storage access**
   - בחירת תיקייה, הרשאה מתמשכת, discovery ויציבות קובץ.
2. **Gate B — Correlation**
   - שיוך בטוח בין artifact להודעה; fail-closed.
3. **Gate C — Decoder**
   - Ogg/Opus ל־PCM, limits, cleanup ובדיקות corpus.
4. **Gate D — Local ASR**
   - adapter, model install, capability routing וביצועים.
5. **Gate E — Pipeline/backend**
   - normalized text event, metadata ברמת הודעה, idempotency ו־KPIs.

אין להתחיל ב־ASR לפני שהוכחו Gate A ו־Gate B. תמלול מהיר של קובץ שלא ניתן להשיג או לשייך בבטחה אינו התקדמות מוצרית.

PR ראשון מומלץ צריך להיות קטן, הפיך ומבוסס על נקודת השילוב שמצאת. אל תציע „PR ענק” שמוסיף storage, decoder, native model, schema ו־UI יחד.

## תנאי עצירה

עצור ודווח במקום לנחש אם אחד מאלה מתקיים:

- מאגר או מודול Android אינו זמין;
- אין מסלול מוכח להשגת קובץ האודיו;
- נדרש מיקרופון, MediaProjection, root, הרשאה רחבה או העלאת אודיו לענן;
- אין דרך לשמור marker ברמת הודעה בחלון מעורב;
- semantics של KPI קיים אינם ברורים;
- נדרש שינוי חוזה backend שעדיין לא הוחלט;
- יש שינויים לא שמורים החופפים לקבצים הנדרשים;
- הקוד הקיים סותר החלטה מחייבת במסמך;
- feature gating אינו יכול להיות fail-closed;
- פרטיות האודיו או התמלול אינה ניתנת להוכחה.

בכל עצירה הצג:

1. הראיה המדויקת;
2. ההשפעה;
3. שתי חלופות בטוחות לכל היותר;
4. ההחלטה הדרושה ממני.

## הפלט שאני מצפה לקבל ממך בסיום המשימה הנוכחית

החזר תשובה תמציתית אך מבוססת ראיות ובה:

1. repo/module/branch/commit שנבדקו;
2. תיאור הזרימה הנוכחית;
3. רשימת נקודות השילוב המדויקות עם paths/symbols;
4. קישור למסמך
   `docs/voice-messages/ANDROID_INTEGRATION_SOURCE_OF_TRUTH.md`;
5. הפערים והסתירות שמצאת;
6. השפעה מדויקת על כל KPI קיים;
7. KPIs חדשים או הרחבות מוצעות והסיבה לכל אחד;
8. privacy blockers;
9. תכנית PRs לפי gates;
10. scope מוצע ל־PR הראשון;
11. החלטות שדורשות אישור.

**אל תשנה עדיין את קוד הפיצ׳ר.** המשימה הנוכחית מסתיימת ב־audit ובמסמך אינטגרציה אמין, שממנו נוכל להתחיל מימוש בלי ליצור תשתית מקבילה או לשבור את ה־KPIs הקיימים.

---

## סוף הפרומפט

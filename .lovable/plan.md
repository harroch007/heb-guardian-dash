

## אין טבלת `message_buffers` בפרויקט

הפרויקט **לא משתמש בטבלת `message_buffers`**. ההודעות מהאפליקציה מגיעות ישירות דרך ה-RPC `create_alert` ונכתבות לטבלת `alerts`.

### מצב נוכחי — כבר מיושם

שתי המשימות שביקשת **כבר בוצעו** בלופים הקודמים:

1. **עמודת `platform`** כבר קיימת בטבלאות: `alerts`, `training_dataset`, `ai_stack_requests`, `daily_chat_stats` — עם `DEFAULT 'WHATSAPP'`.

2. **Unique indexes** כבר עודכנו לכלול `platform`:
   - `alerts`: `(device_id, client_event_id, platform)`
   - `daily_chat_stats`: `(stat_date, device_id, chat_name, platform)`

3. **ה-RPC `create_alert`** כבר מקבל פרמטר `p_platform text DEFAULT 'WHATSAPP'` (פרמטר 13) וכותב אותו לעמודת `platform`.

4. **ה-RPC `increment_daily_chat_stat`** כבר מקבל `p_platform` ומשתמש בו ב-`ON CONFLICT`.

5. **Edge function `analyze-alert`** כבר מעביר את `platform` ל-`training_dataset`.

### סיכום

**אין צורך בשינויים נוספים.** כל מה שביקשת כבר מיושם. האפליקציה יכולה לשלוח `p_platform: 'INSTAGRAM'` או `p_platform: 'WHATSAPP'` דרך `create_alert` והערך ייכתב ויטופל בכל השרשרת.


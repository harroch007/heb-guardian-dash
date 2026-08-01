import { useState } from "react";
import { Send, StickyNote } from "lucide-react";

export function ReplyComposer({
  disabled,
  busy,
  onReply,
  onNote,
}: {
  disabled: boolean;
  busy: boolean;
  onReply: (body: string) => Promise<boolean>;
  onNote: (body: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"REPLY" | "NOTE">("REPLY");
  const [body, setBody] = useState("");

  async function submit() {
    if (!body.trim() || busy || disabled) return;
    const succeeded = mode === "REPLY" ? await onReply(body) : await onNote(body);
    if (succeeded) setBody("");
  }

  return (
    <section className="ct-composer" aria-label="כתיבת מענה או הערה">
      <div className="ct-composer-tabs" role="tablist" aria-label="סוג הודעה">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "REPLY"}
          onClick={() => setMode("REPLY")}
        >
          <Send size={15} aria-hidden="true" /> מענה ללקוח/ה
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "NOTE"}
          onClick={() => setMode("NOTE")}
        >
          <StickyNote size={15} aria-hidden="true" /> הערה פנימית
        </button>
      </div>
      <label>
        <span className="ct-visually-hidden">{mode === "REPLY" ? "תוכן המענה" : "תוכן ההערה"}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={mode === "REPLY" ? "כתבו מענה ברור ובטוח…" : "כתבו תיעוד פנימי לצוות…"}
          disabled={disabled || busy}
          rows={3}
        />
      </label>
      <div className="ct-composer-footer">
        <span>{mode === "NOTE" ? "ההערה לא תישלח ללקוח/ה" : "השליחה מתועדת בציר הזמן"}</span>
        <button
          type="button"
          className="ct-button ct-button-primary"
          disabled={disabled || busy || !body.trim()}
          onClick={() => void submit()}
          data-testid={mode === "REPLY" ? "send-reply" : "add-note"}
        >
          {busy ? "שומרים…" : mode === "REPLY" ? "שליחת מענה" : "שמירת הערה"}
        </button>
      </div>
    </section>
  );
}

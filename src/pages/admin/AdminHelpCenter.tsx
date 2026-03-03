import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const WHATSAPP_MESSAGE = `(שם הורה) היי 😊

שמנו לב שהמכשיר של הילד מנוהל דרך Google Family Link.

במכשירים כאלה חלק מההרשאות שקיפי צריך נחסמות כברירת מחדל - גם אם נראה שאישרת הכול.

כדי שקיפי יוכל להגן בצורה מלאה (זיהוי חרם, אלימות ותוכן מסוכן בזמן אמת),

צריך לבצע בדיקה קצרה דרך אפליקציית Family Link בטלפון של ההורה:

1. פתח/י את אפליקציית Google Family Link בטלפון שלך.

2. בחר/י את הילד הרלוונטי.

3. היכנס/י ל"הגדרות מכשיר".

4. ודא/י שלאפליקציה KippyAI יש:

   • שירותי נגישות (Accessibility) - פעיל

   • גישה להתראות - פעיל

   • גישה לנתוני שימוש - פעיל

   • הרשאת מיקום - מוגדרת ל"כל הזמן"

   • ללא חיסכון בסוללה / ללא הגבלת פעילות ברקע

בלי ההרשאות האלו קיפי לא יכול להגן באופן מלא.

לאחר העדכון, פתח/י שוב את קיפי בטלפון של הילד והמערכת תתעדכן אוטומטית.

אם משהו לא מסתדר - שלחו לנו צילום מסך ונשמח לעזור 💚`;

export function AdminHelpCenter() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WHATSAPP_MESSAGE);
      setCopied(true);
      toast.success("ההודעה הועתקה ללוח!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("שגיאה בהעתקה");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="w-5 h-5 text-green-500" />
            שימוש בקיפי עם Google Family Link
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            הודעת WhatsApp מוכנה לשליחה להורים עם מכשיר מנוהל דרך Family Link
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            dir="rtl"
            className="rounded-lg border border-border/50 bg-muted/30 p-5 text-sm leading-relaxed whitespace-pre-wrap font-sans"
          >
            {WHATSAPP_MESSAGE}
          </div>

          <Button onClick={handleCopy} className="gap-2" variant={copied ? "secondary" : "default"}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "הועתק!" : "העתק ללוח"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

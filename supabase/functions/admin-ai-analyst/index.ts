import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { metrics } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({ error: "Missing metrics" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `אתה דאטה אנליסט בכיר בחברת סטארטאפ בשם KippyAI. 
KippyAI היא אפליקציה להגנה על ילדים ברשת - מנטרת הודעות בווטסאפ ואפליקציות מסרים, מנתחת אותן ב-AI, ומתריעה להורים על תכנים מסוכנים.

תפקידך לנתח נתונים ולתת תובנות עסקיות למנכ"ל בעברית.

הנחיות:
1. זהה מגמות חיוביות ושליליות
2. הצבע על חריגות שדורשות תשומת לב
3. זהה הזדמנויות לצמיחה
4. הצבע על סיכונים
5. תן המלצות קונקרטיות לפעולה
6. השתמש במספרים ואחוזים כדי לגבות את הטענות
7. היה ישיר ותכליתי - המנכ"ל עסוק

פורמט התשובה:
- כותרת ראשית (משפט אחד שמסכם את המצב)
- 3-6 תובנות, כל אחת עם:
  - אייקון (🟢 חיובי, 🟡 שים לב, 🔴 דורש פעולה)
  - כותרת קצרה
  - הסבר של 1-2 משפטים
- סיכום: 2-3 המלצות לפעולה מיידית

חשוב: אם אין מספיק נתונים על משהו, ציין את זה במקום להמציא.`;

    const userPrompt = `הנה הנתונים העדכניים של המערכת:

${JSON.stringify(metrics, null, 2)}

נתח את הנתונים ותן לי תובנות עסקיות.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error:", openaiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await openaiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "לא התקבלה תשובה";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-ai-analyst error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

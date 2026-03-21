import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── NOAA Solar Position Algorithm (simplified) ───
// Returns sunset time as a Date for a given lat/lon/date

function toJulianDay(year: number, month: number, day: number): number {
  if (month <= 2) { year--; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function calcSunset(lat: number, lon: number, date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  const JD = toJulianDay(year, month, day);
  const n = JD - 2451545.0; // days since J2000

  // Mean solar noon
  const J_star = n - lon / 360;

  // Solar mean anomaly
  const M_deg = (357.5291 + 0.98560028 * J_star) % 360;
  const M = M_deg * Math.PI / 180;

  // Equation of the center
  const C = 1.9148 * Math.sin(M) + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M);

  // Ecliptic longitude
  const lambda_deg = (M_deg + C + 180 + 102.9372) % 360;
  const lambda = lambda_deg * Math.PI / 180;

  // Solar transit
  const J_transit = 2451545.0 + J_star + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lambda);

  // Declination of the sun
  const sinDec = Math.sin(lambda) * Math.sin(23.4393 * Math.PI / 180);
  const dec = Math.asin(sinDec);

  // Hour angle for sunset (standard: -0.833 degrees for atmospheric refraction)
  const latRad = lat * Math.PI / 180;
  const cosHourAngle = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(latRad) * Math.sin(dec)) /
    (Math.cos(latRad) * Math.cos(dec));

  if (cosHourAngle > 1 || cosHourAngle < -1) {
    // No sunset (polar day/night) — fallback to 19:00 local
    const fallback = new Date(date);
    fallback.setUTCHours(16, 0, 0, 0); // ~19:00 Israel time
    return fallback;
  }

  const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;

  // Julian date of sunset
  const J_set = J_transit + hourAngle / 360;

  // Convert Julian date to JS Date
  const msFromJ2000 = (J_set - 2440587.5) * 86400000;
  return new Date(msFromJ2000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find all active children with device location (seen in last 7 days)
    const { data: children, error: childErr } = await supabase
      .from("devices")
      .select("child_id, latitude, longitude")
      .not("child_id", "is", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("last_seen", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (childErr) throw childErr;
    if (!children || children.length === 0) {
      return new Response(
        JSON.stringify({ success: true, computed: 0, message: "No active children with location" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate by child_id (take first/most recent)
    const childMap = new Map<string, { lat: number; lon: number }>();
    for (const row of children) {
      if (!childMap.has(row.child_id)) {
        childMap.set(row.child_id, { lat: row.latitude, lon: row.longitude });
      }
    }

    // Calculate next Friday
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 5=Fri
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0) {
      // If today is Friday, check if it's before sunset — if after, skip to next week
      // For simplicity, always compute for this Friday
    }
    const friday = new Date(now);
    friday.setUTCDate(friday.getUTCDate() + daysUntilFriday);
    friday.setUTCHours(12, 0, 0, 0); // noon UTC for calculation

    const saturday = new Date(friday);
    saturday.setUTCDate(saturday.getUTCDate() + 1);
    saturday.setUTCHours(12, 0, 0, 0);

    const fridayDateStr = friday.toISOString().split("T")[0]; // YYYY-MM-DD

    const CANDLE_LIGHTING_OFFSET_MIN = -18; // minutes before sunset
    const HAVDALAH_OFFSET_MIN = 32; // minutes after sunset (Shabbat ends)

    const rows: Array<{
      child_id: string;
      friday_date: string;
      start_epoch_ms: number;
      end_epoch_ms: number;
      latitude: number;
      longitude: number;
      computed_at: string;
    }> = [];

    for (const [childId, loc] of childMap) {
      const fridaySunset = calcSunset(loc.lat, loc.lon, friday);
      const saturdaySunset = calcSunset(loc.lat, loc.lon, saturday);

      const startMs = fridaySunset.getTime() + CANDLE_LIGHTING_OFFSET_MIN * 60 * 1000;
      const endMs = saturdaySunset.getTime() + HAVDALAH_OFFSET_MIN * 60 * 1000;

      rows.push({
        child_id: childId,
        friday_date: fridayDateStr,
        start_epoch_ms: startMs,
        end_epoch_ms: endMs,
        latitude: loc.lat,
        longitude: loc.lon,
        computed_at: new Date().toISOString(),
      });
    }

    // Batch upsert
    const { error: upsertErr } = await supabase
      .from("shabbat_times_computed")
      .upsert(rows, { onConflict: "child_id,friday_date" });

    if (upsertErr) throw upsertErr;

    // Log sample for debugging
    const sample = rows[0];
    console.log(
      `Computed shabbat times for ${rows.length} children. Sample: ` +
      `friday=${sample?.friday_date}, start=${new Date(sample?.start_epoch_ms).toISOString()}, ` +
      `end=${new Date(sample?.end_epoch_ms).toISOString()}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        computed: rows.length,
        friday_date: fridayDateStr,
        sample: sample ? {
          start: new Date(sample.start_epoch_ms).toISOString(),
          end: new Date(sample.end_epoch_ms).toISOString(),
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("calculate-shabbat-times error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

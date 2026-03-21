import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── NOAA Sunset Calculator ───
// Based on NOAA Solar Calculator spreadsheet
// Returns sunset as a Date (UTC) for given lat/lon/date

function calcSunsetUTC(lat: number, lon: number, year: number, month: number, day: number): Date {
  // Julian Day Number
  if (month <= 2) { year--; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  
  // Julian Century
  const T = (JD - 2451545.0) / 36525.0;
  
  // Geometric Mean Longitude of Sun (degrees)
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  
  // Geometric Mean Anomaly of Sun (degrees)
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const Mrad = M * Math.PI / 180;
  
  // Eccentricity of Earth's Orbit
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  
  // Sun's Equation of Center
  const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);
  
  // Sun's True Longitude
  const sunLon = L0 + C;
  
  // Sun's Apparent Longitude
  const omega = 125.04 - 1934.136 * T;
  const lambda = sunLon - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
  const lambdaRad = lambda * Math.PI / 180;
  
  // Mean Obliquity of Ecliptic
  const obliq0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliqCorr = obliq0 + 0.00256 * Math.cos(omega * Math.PI / 180);
  const obliqRad = obliqCorr * Math.PI / 180;
  
  // Sun's Declination
  const sinDec = Math.sin(obliqRad) * Math.sin(lambdaRad);
  const dec = Math.asin(sinDec);
  
  // Equation of Time (minutes)
  const y = Math.tan(obliqRad / 2) * Math.tan(obliqRad / 2);
  const L0rad = L0 * Math.PI / 180;
  const EqTime = 4 * (180 / Math.PI) * (
    y * Math.sin(2 * L0rad)
    - 2 * e * Math.sin(Mrad)
    + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * L0rad)
    - 0.5 * y * y * Math.sin(4 * L0rad)
    - 1.25 * e * e * Math.sin(2 * Mrad)
  );
  
  // Hour Angle of Sunset (degrees)
  const latRad = lat * Math.PI / 180;
  const zenith = 90.833; // Standard refraction for sunset
  const cosHA = (Math.cos(zenith * Math.PI / 180) / (Math.cos(latRad) * Math.cos(dec)))
    - Math.tan(latRad) * Math.tan(dec);
  
  if (cosHA > 1 || cosHA < -1) {
    // No sunset (polar) — fallback 19:00 Israel time = 16:00 UTC
    const fb = new Date(Date.UTC(year <= 0 ? year + 1 : year, month > 12 ? month - 13 : month - 1, day, 16, 0, 0));
    return fb;
  }
  
  const HA = Math.acos(cosHA) * 180 / Math.PI;
  
  // Sunset time in minutes from midnight UTC (lon - HA for sunset, lon + HA for sunrise)
  const sunsetMinutesUTC = 720 - 4 * (lon - HA) - EqTime;
  
  // Convert to Date
  // Recover original year/month/day (before the adjustment for JD)
  // We need the original input values, so let's use the function params differently
  // Actually we modified year/month above for JD calc, so we need originals
  // Let's just compute from JD base
  const sunsetHours = Math.floor(sunsetMinutesUTC / 60);
  const sunsetMins = Math.floor(sunsetMinutesUTC % 60);
  const sunsetSecs = Math.round((sunsetMinutesUTC % 1) * 60);
  
  // Build date from JD (noon of this day)
  const baseMs = (JD - 2440587.5) * 86400000; // ms from Unix epoch at 0:00 UTC of this day
  const result = new Date(baseMs);
  result.setUTCHours(sunsetHours, sunsetMins, sunsetSecs, 0);
  
  return result;
}

function getSunset(lat: number, lon: number, date: Date): Date {
  return calcSunsetUTC(lat, lon, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
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
      // Today is Friday — still compute for today
    }
    const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFriday));
    const saturday = new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate() + 1));

    const fridayDateStr = friday.toISOString().split("T")[0];

    const CANDLE_LIGHTING_OFFSET_MS = -18 * 60 * 1000; // 18 min before sunset
    const HAVDALAH_OFFSET_MS = 32 * 60 * 1000; // 32 min after sunset

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
      const fridaySunset = getSunset(loc.lat, loc.lon, friday);
      const saturdaySunset = getSunset(loc.lat, loc.lon, saturday);

      const startMs = fridaySunset.getTime() + CANDLE_LIGHTING_OFFSET_MS;
      const endMs = saturdaySunset.getTime() + HAVDALAH_OFFSET_MS;

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

    // Log sample
    const sample = rows[0];
    console.log(
      `Computed shabbat for ${rows.length} children. friday=${fridayDateStr}. ` +
      `Sample: start=${new Date(sample?.start_epoch_ms).toISOString()}, end=${new Date(sample?.end_epoch_ms).toISOString()}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        computed: rows.length,
        friday_date: fridayDateStr,
        sample: sample ? {
          start_utc: new Date(sample.start_epoch_ms).toISOString(),
          end_utc: new Date(sample.end_epoch_ms).toISOString(),
          lat: sample.latitude,
          lon: sample.longitude,
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

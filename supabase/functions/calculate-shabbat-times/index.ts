import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── NOAA Sunset Calculator ───
function calcSunsetUTC(lat: number, lon: number, year: number, month: number, day: number): Date {
  if (month <= 2) { year--; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  const T = (JD - 2451545.0) / 36525.0;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const Mrad = M * Math.PI / 180;
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);
  const sunLon = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = sunLon - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
  const lambdaRad = lambda * Math.PI / 180;
  const obliq0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliqCorr = obliq0 + 0.00256 * Math.cos(omega * Math.PI / 180);
  const obliqRad = obliqCorr * Math.PI / 180;
  const sinDec = Math.sin(obliqRad) * Math.sin(lambdaRad);
  const dec = Math.asin(sinDec);
  const y = Math.tan(obliqRad / 2) * Math.tan(obliqRad / 2);
  const L0rad = L0 * Math.PI / 180;
  const EqTime = 4 * (180 / Math.PI) * (
    y * Math.sin(2 * L0rad)
    - 2 * e * Math.sin(Mrad)
    + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * L0rad)
    - 0.5 * y * y * Math.sin(4 * L0rad)
    - 1.25 * e * e * Math.sin(2 * Mrad)
  );
  const latRad = lat * Math.PI / 180;
  const zenith = 90.833;
  const cosHA = (Math.cos(zenith * Math.PI / 180) / (Math.cos(latRad) * Math.cos(dec)))
    - Math.tan(latRad) * Math.tan(dec);
  if (cosHA > 1 || cosHA < -1) {
    const fb = new Date(Date.UTC(year <= 0 ? year + 1 : year, month > 12 ? month - 13 : month - 1, day, 16, 0, 0));
    return fb;
  }
  const HA = Math.acos(cosHA) * 180 / Math.PI;
  const sunsetMinutesUTC = 720 - 4 * (lon - HA) - EqTime;
  const sunsetHours = Math.floor(sunsetMinutesUTC / 60);
  const sunsetMins = Math.floor(sunsetMinutesUTC % 60);
  const sunsetSecs = Math.round((sunsetMinutesUTC % 1) * 60);
  const baseMs = (JD - 2440587.5) * 86400000;
  const result = new Date(baseMs);
  result.setUTCHours(sunsetHours, sunsetMins, sunsetSecs, 0);
  return result;
}

function getSunset(lat: number, lon: number, date: Date): Date {
  return calcSunsetUTC(lat, lon, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

// ─── Helpers ───

const CANDLE_OFFSET_MS = -18 * 60 * 1000; // 18 min before sunset
const HAVDALAH_OFFSET_MS = 32 * 60 * 1000; // 32 min after sunset
const MERGE_GAP_MS = 10 * 60 * 1000; // 10 min merge threshold

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function dateFromStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// ─── Window Generation ───

interface IssurWindow {
  lock_type: "shabbat" | "yom_tov";
  event_name: string;
  event_key: string;
  valid_for_date: string;
  start_epoch_ms: number;
  end_epoch_ms: number;
}

function generateShabbatWindows(lat: number, lon: number, startDate: Date, days: number): IssurWindow[] {
  const windows: IssurWindow[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    if (d.getUTCDay() === 5) { // Friday
      const fridaySunset = getSunset(lat, lon, d);
      const saturdaySunset = getSunset(lat, lon, addDays(d, 1));
      const startMs = fridaySunset.getTime() + CANDLE_OFFSET_MS;
      const endMs = saturdaySunset.getTime() + HAVDALAH_OFFSET_MS;
      const dateStr = formatDate(d);
      windows.push({
        lock_type: "shabbat",
        event_name: "Shabbat",
        event_key: `shabbat-${dateStr}`,
        valid_for_date: dateStr,
        start_epoch_ms: startMs,
        end_epoch_ms: endMs,
      });
    }
  }
  return windows;
}

interface HebcalHoliday {
  title: string;
  date: string;
  yomtov?: boolean;
}

function generateYomTovWindows(
  holidays: HebcalHoliday[],
  lat: number,
  lon: number
): IssurWindow[] {
  // Each yom tov day: candle lighting = sunset of day before - 18 min
  // Havdalah = sunset of yom tov day + 32 min
  // BUT if the next day is also yom tov, we extend (merge will handle)
  const windows: IssurWindow[] = [];

  for (const h of holidays) {
    if (!h.yomtov) continue;
    const yomTovDate = dateFromStr(h.date.substring(0, 10));
    const dayBefore = addDays(yomTovDate, -1);

    // Candle lighting = sunset of day before - 18 min
    // Special case: if day before is Shabbat (Saturday=6), use Shabbat candles (Friday sunset)
    // But actually for yom tov starting motzei shabbat, candles are lit after havdalah
    // For simplicity: sunset of day before - 18 min for start
    const erevSunset = getSunset(lat, lon, dayBefore);
    const yomTovSunset = getSunset(lat, lon, yomTovDate);

    const startMs = erevSunset.getTime() + CANDLE_OFFSET_MS;
    const endMs = yomTovSunset.getTime() + HAVDALAH_OFFSET_MS;

    const dateStr = h.date.substring(0, 10);
    // Sanitize title for event_key
    const titleSlug = h.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");

    windows.push({
      lock_type: "yom_tov",
      event_name: h.title,
      event_key: `yomtov-${titleSlug}-${dateStr}`,
      valid_for_date: dateStr,
      start_epoch_ms: startMs,
      end_epoch_ms: endMs,
    });
  }

  return windows;
}

function mergeWindows(windows: IssurWindow[]): IssurWindow[] {
  if (windows.length <= 1) return windows;
  windows.sort((a, b) => a.start_epoch_ms - b.start_epoch_ms);

  const merged: IssurWindow[] = [{ ...windows[0] }];

  for (let i = 1; i < windows.length; i++) {
    const current = merged[merged.length - 1];
    const next = windows[i];

    if (next.start_epoch_ms <= current.end_epoch_ms + MERGE_GAP_MS) {
      // Merge
      current.end_epoch_ms = Math.max(current.end_epoch_ms, next.end_epoch_ms);
      current.start_epoch_ms = Math.min(current.start_epoch_ms, next.start_epoch_ms);
      if (!current.event_name.includes(next.event_name) && current.event_name !== next.event_name) {
        current.event_name = `${current.event_name} + ${next.event_name}`;
      }
      // If merging shabbat with yom_tov, keep the more specific type
      if (next.lock_type === "yom_tov" || current.lock_type === "yom_tov") {
        if (current.lock_type === "shabbat" && next.lock_type === "yom_tov") {
          current.event_name = current.event_name.replace(" + ", " / ");
        }
      }
    } else {
      merged.push({ ...next });
    }
  }

  return merged;
}

// ─── Hebcal Fetch ───

async function fetchYomTovDates(startDate: Date, days: number): Promise<HebcalHoliday[]> {
  // Fetch holidays for the relevant year(s)
  const year = startDate.getUTCFullYear();
  const endDate = addDays(startDate, days);
  const endYear = endDate.getUTCFullYear();

  const years = [year];
  if (endYear !== year) years.push(endYear);

  const allHolidays: HebcalHoliday[] = [];

  for (const y of years) {
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${y}&month=x&maj=on&yto=on&i=on&M=on`;
    console.log(`[Hebcal] Fetching: ${url}`);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[Hebcal] HTTP ${resp.status} for year ${y}`);
      await resp.text(); // consume body
      continue;
    }
    const data = await resp.json();
    const items = data.items || [];
    for (const item of items) {
      if (item.yomtov === true) {
        const itemDate = dateFromStr(item.date.substring(0, 10));
        if (itemDate >= startDate && itemDate <= endDate) {
          allHolidays.push(item);
        }
      }
    }
  }

  console.log(`[Hebcal] Found ${allHolidays.length} yom tov days in range ${formatDate(startDate)}-${formatDate(endDate)}`);
  return allHolidays;
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find all active children with device location
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

    // Deduplicate by child_id
    const childMap = new Map<string, { lat: number; lon: number }>();
    for (const row of children) {
      if (!childMap.has(row.child_id)) {
        childMap.set(row.child_id, { lat: row.latitude, lon: row.longitude });
      }
    }

    const now = new Date();
    const LOOKAHEAD_DAYS = 30;

    // ─── Phase 1: shabbat_times_computed (next Shabbat only, existing behavior) ───
    const dayOfWeek = now.getUTCDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFriday));
    const saturday = addDays(friday, 1);
    const fridayDateStr = formatDate(friday);

    const shabbatRows: Array<{
      child_id: string; friday_date: string;
      start_epoch_ms: number; end_epoch_ms: number;
      latitude: number; longitude: number; computed_at: string;
    }> = [];

    for (const [childId, loc] of childMap) {
      const fridaySunset = getSunset(loc.lat, loc.lon, friday);
      const saturdaySunset = getSunset(loc.lat, loc.lon, saturday);
      shabbatRows.push({
        child_id: childId,
        friday_date: fridayDateStr,
        start_epoch_ms: fridaySunset.getTime() + CANDLE_OFFSET_MS,
        end_epoch_ms: saturdaySunset.getTime() + HAVDALAH_OFFSET_MS,
        latitude: loc.lat, longitude: loc.lon,
        computed_at: new Date().toISOString(),
      });
    }

    const { error: upsertErr } = await supabase
      .from("shabbat_times_computed")
      .upsert(shabbatRows, { onConflict: "child_id,friday_date" });
    if (upsertErr) throw upsertErr;

    console.log(`[Phase 1] shabbat_times_computed: ${shabbatRows.length} rows for ${fridayDateStr}`);

    // ─── Phase 2: issur_melacha_windows (30 days, shabbat + yom tov) ───

    // Fetch yom tov dates from Hebcal (shared for all children — same dates for Israel)
    const yomTovHolidays = await fetchYomTovDates(now, LOOKAHEAD_DAYS);

    let totalPreMerge = 0;
    let totalSaved = 0;

    for (const [childId, loc] of childMap) {
      // Generate Shabbat windows (30 days)
      const shabbatWindows = generateShabbatWindows(loc.lat, loc.lon, now, LOOKAHEAD_DAYS);

      // Generate Yom Tov windows
      const yomTovWindows = generateYomTovWindows(yomTovHolidays, loc.lat, loc.lon);

      const allWindows = [...shabbatWindows, ...yomTovWindows];
      totalPreMerge += allWindows.length;

      const merged = mergeWindows(allWindows);

      console.log(
        `[Phase 2] child=${childId} lat=${loc.lat} lon=${loc.lon} ` +
        `shabbat=${shabbatWindows.length} yomtov=${yomTovWindows.length} ` +
        `pre_merge=${allWindows.length} post_merge=${merged.length}`
      );

      if (merged.length > 0) {
        const dbRows = merged.map(w => ({
          child_id: childId,
          lock_type: w.lock_type,
          event_name: w.event_name,
          event_key: w.event_key,
          valid_for_date: w.valid_for_date,
          start_epoch_ms: w.start_epoch_ms,
          end_epoch_ms: w.end_epoch_ms,
          latitude: loc.lat,
          longitude: loc.lon,
          timezone: "Asia/Jerusalem",
          source: "hebcal_jewish_calendar",
          computed_at: new Date().toISOString(),
          is_active: true,
        }));

        const { error: windowErr } = await supabase
          .from("issur_melacha_windows")
          .upsert(dbRows, { onConflict: "child_id,event_key,start_epoch_ms" });

        if (windowErr) {
          console.error(`[Phase 2] upsert error child=${childId}: ${windowErr.message}`);
        } else {
          totalSaved += merged.length;
        }
      }
    }

    console.log(
      `[Summary] shabbat_computed=${shabbatRows.length}, ` +
      `issur_pre_merge=${totalPreMerge}, issur_saved=${totalSaved}, ` +
      `children=${childMap.size}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        shabbat_computed: shabbatRows.length,
        friday_date: fridayDateStr,
        issur_windows_pre_merge: totalPreMerge,
        issur_windows_saved: totalSaved,
        yom_tov_dates_found: yomTovHolidays.length,
        children_processed: childMap.size,
        sample: shabbatRows[0] ? {
          start_utc: new Date(shabbatRows[0].start_epoch_ms).toISOString(),
          end_utc: new Date(shabbatRows[0].end_epoch_ms).toISOString(),
          lat: shabbatRows[0].latitude,
          lon: shabbatRows[0].longitude,
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

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

// ─── Hebcal Integration ───

interface HebcalItem {
  title: string;
  date: string;
  category: string;
  subcat?: string;
  memo?: string;
  yomtov?: boolean;
}

interface IssurWindow {
  lock_type: "shabbat" | "yom_tov";
  event_name: string;
  event_key: string;
  valid_for_date: string;
  start_epoch_ms: number;
  end_epoch_ms: number;
  latitude: number;
  longitude: number;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildHebcalUrl(lat: number, lon: number, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    v: "1",
    cfg: "json",
    start: startDate,
    end: endDate,
    maj: "on",
    yto: "on",
    i: "on",
    c: "on",
    M: "on",
    latitude: lat.toString(),
    longitude: lon.toString(),
    tzid: "Asia/Jerusalem",
  });
  return `https://www.hebcal.com/hebcal?${params.toString()}`;
}

function parseHebcalToWindows(items: HebcalItem[], lat: number, lon: number): IssurWindow[] {
  // Extract candles and havdalah events in order
  const events: Array<{ type: "candles" | "havdalah"; date: string; isoDate: string; title: string; category: string; yomtov: boolean }> = [];

  for (const item of items) {
    if (item.category === "candles") {
      events.push({
        type: "candles",
        date: item.date,
        isoDate: item.date,
        title: item.title,
        category: item.category,
        yomtov: false,
      });
    } else if (item.category === "havdalah") {
      events.push({
        type: "havdalah",
        date: item.date,
        isoDate: item.date,
        title: item.title,
        category: item.category,
        yomtov: false,
      });
    }
  }

  // Build a set of yom tov dates from holiday items
  const yomTovDates = new Set<string>();
  for (const item of items) {
    if (item.category === "holiday" && item.yomtov === true) {
      // date format from hebcal is ISO, extract just date part
      const dateStr = item.date.substring(0, 10);
      yomTovDates.add(dateStr);
    }
  }

  // Pair: each candles -> next havdalah
  const windows: IssurWindow[] = [];
  let i = 0;
  while (i < events.length) {
    if (events[i].type === "candles") {
      const candleEvent = events[i];
      // Find next havdalah
      let j = i + 1;
      while (j < events.length && events[j].type !== "havdalah") {
        j++;
      }
      if (j < events.length) {
        const havdalahEvent = events[j];
        const startMs = new Date(candleEvent.date).getTime();
        const endMs = new Date(havdalahEvent.date).getTime();
        const candleDateStr = candleEvent.date.substring(0, 10);

        // Determine if this is shabbat or yom_tov
        // If the candle date is a Friday (day 5), it's shabbat
        // Otherwise check if any yom tov date falls within this window
        const candleDateObj = new Date(candleDateStr);
        const dayOfWeek = candleDateObj.getUTCDay(); // 5 = Friday

        let lockType: "shabbat" | "yom_tov" = "shabbat";
        let eventName = "Shabbat";

        if (dayOfWeek !== 5) {
          // Not Friday -> must be yom tov
          lockType = "yom_tov";
          // Try to find the holiday name from items
          const holidayItem = items.find(
            it => it.category === "holiday" && it.yomtov === true && it.date.substring(0, 10) === candleDateStr
          );
          // Also check the next day
          const nextDay = new Date(candleDateObj);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          const nextDayStr = formatDate(nextDay);
          const holidayNextDay = items.find(
            it => it.category === "holiday" && it.yomtov === true && it.date.substring(0, 10) === nextDayStr
          );
          eventName = holidayItem?.title || holidayNextDay?.title || candleEvent.title.replace("Candle lighting: ", "");
        } else {
          // It's Friday but could also overlap with yom tov
          // Check if the Saturday is also a yom tov
          const satDate = new Date(candleDateObj);
          satDate.setUTCDate(satDate.getUTCDate() + 1);
          if (yomTovDates.has(formatDate(satDate))) {
            // Shabbat + Yom Tov combo — keep as shabbat but note the name
            const holidayItem = items.find(
              it => it.category === "holiday" && it.yomtov === true && it.date.substring(0, 10) === formatDate(satDate)
            );
            if (holidayItem) {
              eventName = `Shabbat / ${holidayItem.title}`;
            }
          }
        }

        const eventKey = `${lockType}-${candleDateStr}`;

        windows.push({
          lock_type: lockType,
          event_name: eventName,
          event_key: eventKey,
          valid_for_date: candleDateStr,
          start_epoch_ms: startMs,
          end_epoch_ms: endMs,
          latitude: lat,
          longitude: lon,
        });

        i = j + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return windows;
}

function mergeOverlappingWindows(windows: IssurWindow[]): IssurWindow[] {
  if (windows.length <= 1) return windows;

  // Sort by start
  windows.sort((a, b) => a.start_epoch_ms - b.start_epoch_ms);

  const MERGE_GAP_MS = 10 * 60 * 1000; // 10 minutes
  const merged: IssurWindow[] = [windows[0]];

  for (let i = 1; i < windows.length; i++) {
    const current = merged[merged.length - 1];
    const next = windows[i];

    if (next.start_epoch_ms <= current.end_epoch_ms + MERGE_GAP_MS) {
      // Merge
      current.end_epoch_ms = Math.max(current.end_epoch_ms, next.end_epoch_ms);
      current.start_epoch_ms = Math.min(current.start_epoch_ms, next.start_epoch_ms);
      // Combine names if different
      if (!current.event_name.includes(next.event_name) && current.event_name !== next.event_name) {
        current.event_name = `${current.event_name} + ${next.event_name}`;
      }
      // If any part is yom_tov, mark as yom_tov (unless it started as shabbat)
      if (next.lock_type === "yom_tov" && current.lock_type === "shabbat") {
        current.lock_type = "shabbat"; // Keep as shabbat if it started on shabbat
        current.event_name = current.event_name.replace(" + ", " / ");
      }
      // Keep the earlier event_key
    } else {
      merged.push({ ...next });
    }
  }

  return merged;
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

    // ─── Phase 1: Shabbat (existing NOAA logic) ───
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0) { /* Today is Friday — compute for today */ }
    const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFriday));
    const saturday = new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate() + 1));
    const fridayDateStr = friday.toISOString().split("T")[0];

    const CANDLE_LIGHTING_OFFSET_MS = -18 * 60 * 1000;
    const HAVDALAH_OFFSET_MS = 32 * 60 * 1000;

    const shabbatRows: Array<{
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

      shabbatRows.push({
        child_id: childId,
        friday_date: fridayDateStr,
        start_epoch_ms: startMs,
        end_epoch_ms: endMs,
        latitude: loc.lat,
        longitude: loc.lon,
        computed_at: new Date().toISOString(),
      });
    }

    // Batch upsert shabbat_times_computed
    const { error: upsertErr } = await supabase
      .from("shabbat_times_computed")
      .upsert(shabbatRows, { onConflict: "child_id,friday_date" });

    if (upsertErr) throw upsertErr;

    const sample = shabbatRows[0];
    console.log(
      `[Phase 1] Computed shabbat for ${shabbatRows.length} children. friday=${fridayDateStr}. ` +
      `Sample: start=${new Date(sample?.start_epoch_ms).toISOString()}, end=${new Date(sample?.end_epoch_ms).toISOString()}`
    );

    // ─── Phase 2: Hebcal — issur melacha windows (30 days) ───
    const startDate = formatDate(now);
    const endDateObj = new Date(now);
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 30);
    const endDate = formatDate(endDateObj);

    let totalWindowsSaved = 0;
    let totalWindowsPreMerge = 0;

    for (const [childId, loc] of childMap) {
      const url = buildHebcalUrl(loc.lat, loc.lon, startDate, endDate);
      console.log(`[Phase 2] child=${childId} lat=${loc.lat} lon=${loc.lon} url=${url}`);

      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          console.error(`[Phase 2] Hebcal HTTP error ${resp.status} for child=${childId}`);
          continue;
        }

        const data = await resp.json();
        const items: HebcalItem[] = data.items || [];
        console.log(`[Phase 2] child=${childId} hebcal items=${items.length}`);

        const rawWindows = parseHebcalToWindows(items, loc.lat, loc.lon);
        totalWindowsPreMerge += rawWindows.length;
        console.log(`[Phase 2] child=${childId} raw windows (pre-merge)=${rawWindows.length}`);

        const mergedWindows = mergeOverlappingWindows(rawWindows);
        console.log(`[Phase 2] child=${childId} merged windows=${mergedWindows.length}`);

        if (mergedWindows.length > 0) {
          const dbRows = mergedWindows.map(w => ({
            child_id: childId,
            lock_type: w.lock_type,
            event_name: w.event_name,
            event_key: w.event_key,
            valid_for_date: w.valid_for_date,
            start_epoch_ms: w.start_epoch_ms,
            end_epoch_ms: w.end_epoch_ms,
            latitude: w.latitude,
            longitude: w.longitude,
            timezone: "Asia/Jerusalem",
            source: "hebcal_jewish_calendar",
            computed_at: new Date().toISOString(),
            is_active: true,
          }));

          const { error: windowErr } = await supabase
            .from("issur_melacha_windows")
            .upsert(dbRows, { onConflict: "child_id,event_key,start_epoch_ms" });

          if (windowErr) {
            console.error(`[Phase 2] upsert error for child=${childId}: ${windowErr.message}`);
          } else {
            totalWindowsSaved += mergedWindows.length;
          }
        }
      } catch (hebcalErr) {
        console.error(`[Phase 2] Hebcal fetch error for child=${childId}: ${hebcalErr}`);
      }
    }

    console.log(
      `[Summary] shabbat_computed=${shabbatRows.length}, ` +
      `issur_windows_pre_merge=${totalWindowsPreMerge}, ` +
      `issur_windows_saved=${totalWindowsSaved}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        shabbat_computed: shabbatRows.length,
        friday_date: fridayDateStr,
        issur_windows_pre_merge: totalWindowsPreMerge,
        issur_windows_saved: totalWindowsSaved,
        children_processed: childMap.size,
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

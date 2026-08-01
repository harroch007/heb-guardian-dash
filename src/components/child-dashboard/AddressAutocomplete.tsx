/* eslint-disable @typescript-eslint/no-explicit-any -- Frozen legacy donor surface; migrate types before reactivation. */
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface NormalizedResult {
  id: string;
  lat: number;
  lon: number;
  label: string;
}

interface AddressAutocompleteProps {
  onSelect: (result: { latitude: number; longitude: number; address: string }) => void;
  /** Opens the map picker. Receives the current typed query so it can be saved as a label fallback. */
  onFallback?: (query?: string) => void;
  placeholder?: string;
  className?: string;
}

// ---------- Photon (komoot) — primary engine ----------
// Free, no API key, OSM-based with Elasticsearch — significantly better fuzzy
// matching for Israeli addresses than vanilla Nominatim free text.
async function searchPhoton(q: string): Promise<NormalizedResult[]> {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&lang=he&limit=8&lat=32.08&lon=34.78&location_bias_scale=0.6`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  return features
    .filter((f) => f?.properties?.countrycode === "IL" || f?.properties?.country === "ישראל" || f?.properties?.country === "Israel")
    .map((f, i) => {
      const p = f.properties || {};
      const [lon, lat] = f.geometry?.coordinates || [];
      const city = p.city || p.town || p.village || p.county || "";
      const parts: string[] = [];
      if (p.street) {
        parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
      } else if (p.name) {
        parts.push(p.name);
      }
      if (city && !parts.includes(city)) parts.push(city);
      const label = parts.length > 0 ? parts.join(", ") : (p.name || `${lat?.toFixed(5)}, ${lon?.toFixed(5)}`);
      return {
        id: `ph-${p.osm_id ?? i}-${i}`,
        lat: Number(lat),
        lon: Number(lon),
        label,
      };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

// ---------- Nominatim — structured fallback ----------
// Splits the typed query into street + city. Common Israeli formats:
//   "סוקולוב 75 הרצליה"  -> street="סוקולוב 75", city="הרצליה"
//   "סוקולוב 75, הרצליה" -> same
function splitIsraeliAddress(q: string): { street?: string; city?: string } {
  const trimmed = q.trim();
  if (!trimmed) return {};
  if (trimmed.includes(",")) {
    const [a, b] = trimmed.split(",", 2).map((s) => s.trim());
    return { street: a || undefined, city: b || undefined };
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return { street: trimmed };
  // Last token = city when it's purely letters; otherwise treat whole thing as street
  const last = tokens[tokens.length - 1];
  if (/^[\u0590-\u05FFa-zA-Z'״"-]+$/.test(last) && tokens.length >= 2) {
    return { street: tokens.slice(0, -1).join(" "), city: last };
  }
  return { street: trimmed };
}

async function searchNominatimStructured(q: string): Promise<NormalizedResult[]> {
  const { street, city } = splitIsraeliAddress(q);
  const params = new URLSearchParams({
    format: "json",
    countrycodes: "il",
    limit: "8",
    "accept-language": "he",
    addressdetails: "1",
    dedupe: "1",
  });
  if (street) params.set("street", street);
  if (city) params.set("city", city);
  // If we couldn't split, fall back to free-text q
  if (!street && !city) params.set("q", q);

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!res.ok) return [];
  const data: any[] = await res.json();
  return (data || []).map((r, i) => {
    const a = r.address || {};
    const c = a.city || a.town || a.village || "";
    const parts: string[] = [];
    if (a.road) parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
    if (c) parts.push(c);
    const label = parts.length ? parts.join(", ") : (r.display_name?.split(",").slice(0, 3).join(",").trim() || `${r.lat}, ${r.lon}`);
    return {
      id: `nm-${r.place_id ?? i}-${i}`,
      lat: Number(r.lat),
      lon: Number(r.lon),
      label,
    };
  }).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

export function AddressAutocomplete({
  onSelect,
  onFallback,
  placeholder = "הכנס כתובת: רחוב, מספר, עיר",
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      setNoResults(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      // Tier 1: Photon
      let merged = await searchPhoton(q);
      // Tier 2: Nominatim structured fallback if Photon returned nothing
      if (merged.length === 0) {
        merged = await searchNominatimStructured(q);
      }
      // Drop near-duplicates
      const seen = new Set<string>();
      const unique = merged.filter((r) => {
        const key = `${r.label}|${r.lat.toFixed(4)}|${r.lon.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (myReq !== reqIdRef.current) return; // stale
      setResults(unique);
      setOpen(unique.length > 0);
      setNoResults(unique.length === 0);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setResults([]);
      setOpen(false);
      setNoResults(true);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (r: NormalizedResult) => {
    setQuery(r.label);
    setOpen(false);
    onSelect({ latitude: r.lat, longitude: r.lon, address: r.label });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="text-xs h-8 pr-8"
          dir="rtl"
        />
        {loading && (
          <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-right hover:bg-accent transition-colors"
              onClick={() => handleSelect(r)}
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* No results — keep the parent in flow with two escape hatches */}
      {noResults && !open && (
        <div className="mt-1 text-xs text-muted-foreground space-y-1.5">
          <p>לא נמצאו תוצאות לכתובת הזו.</p>
          {onFallback && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="text-primary underline text-[11px] text-right"
                onClick={() => onFallback(query)}
              >
                📍 סמן את המיקום על המפה
              </button>
              <button
                type="button"
                className="text-primary underline text-[11px] text-right"
                onClick={() => onFallback(query)}
              >
                ✏️ שמור עם הטקסט שכתבתי וסמן על המפה
              </button>
            </div>
          )}
        </div>
      )}

      {/* Always-on escape hatch — visible even before typing or while there are results */}
      {onFallback && !noResults && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline mt-1"
          onClick={() => onFallback(query)}
        >
          לא מוצא את הכתובת? סמן על המפה
        </button>
      )}
    </div>
  );
}

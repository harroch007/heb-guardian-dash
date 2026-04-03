import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface NominatimAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

interface AddressAutocompleteProps {
  onSelect: (result: { latitude: number; longitude: number; address: string }) => void;
  onFallback?: () => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  onSelect,
  onFallback,
  placeholder = "הכנס כתובת: רחוב, מספר, עיר",
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      setNoResults(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=il&limit=8&accept-language=he&addressdetails=1&dedupe=1`
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatAddress = (r: NominatimResult): string => {
    const a = r.address;
    if (a) {
      const city = a.city || a.town || a.village || "";
      const parts: string[] = [];
      if (a.road) {
        parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
      }
      if (city) parts.push(city);
      if (parts.length > 0) return parts.join(", ");
    }
    return r.display_name.split(",").slice(0, 3).join(",").trim();
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (r: NominatimResult) => {
    const shortName = formatAddress(r);
    setQuery(shortName);
    setOpen(false);
    onSelect({
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      address: shortName,
    });
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
          {results.map((r) => {
            const short = formatAddress(r);
            return (
              <button
                key={r.place_id}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-right hover:bg-accent transition-colors"
                onClick={() => handleSelect(r)}
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{short}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

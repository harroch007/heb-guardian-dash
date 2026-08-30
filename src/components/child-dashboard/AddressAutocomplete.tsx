import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps } from "@/lib/googleMaps";

interface NormalizedResult {
  id: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
}

interface AddressAutocompleteProps {
  onSelect: (result: { latitude: number; longitude: number; address: string }) => void;
  /** Opens the map picker. Receives the current typed query so it can be saved as a label fallback. */
  onFallback?: (query?: string) => void;
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
  const [results, setResults] = useState<NormalizedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // One token per typing session — bundles suggestions + the final place-details
  // fetch into a single billed Places session instead of per-keystroke billing.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const getSessionToken = useCallback(async () => {
    const g = await loadGoogleMaps();
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

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
      const g = await loadGoogleMaps();
      const sessionToken = await getSessionToken();
      const { suggestions } = await g.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ["il"],
        language: "he",
        sessionToken,
      });

      const unique = (suggestions ?? [])
        .filter((s): s is google.maps.places.AutocompleteSuggestion & { placePrediction: google.maps.places.PlacePrediction } =>
          Boolean(s.placePrediction))
        .map((s, i) => ({
          id: s.placePrediction.placeId ?? `gp-${i}`,
          label: s.placePrediction.text?.text ?? "",
          prediction: s.placePrediction,
        }));

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
  }, [getSessionToken]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      // Cleared input starts a fresh autocomplete session.
      sessionTokenRef.current = null;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = async (r: NormalizedResult) => {
    setQuery(r.label);
    setOpen(false);
    setLoading(true);
    try {
      const place = r.prediction.toPlace();
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const location = place.location;
      if (location) {
        onSelect({
          latitude: location.lat(),
          longitude: location.lng(),
          address: place.formattedAddress ?? r.label,
        });
      }
    } finally {
      setLoading(false);
      // Selection ends this autocomplete session — next keystroke starts a new one.
      sessionTokenRef.current = null;
    }
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

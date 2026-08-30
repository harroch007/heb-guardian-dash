import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMaps";

interface MapPinPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  /** Free-text label the parent typed; used if reverse geocoding fails or returns nothing useful. */
  fallbackLabel?: string;
  onConfirm: (result: { latitude: number; longitude: number; address: string }) => void;
  onCancel: () => void;
}

export function MapPinPicker({ initialLat, initialLng, fallbackLabel, onConfirm, onCancel }: MapPinPickerProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const g = await loadGoogleMaps();
      if (!geocoderRef.current) geocoderRef.current = new g.maps.Geocoder();
      const { results } = await geocoderRef.current.geocode({ location: { lat, lng }, language: "he" });
      const first = results?.[0];
      const comps = first?.address_components ?? [];
      const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name;
      const road = get("route");
      const houseNumber = get("street_number");
      const city = get("locality") || get("postal_town") || get("administrative_area_level_2");
      const parts: string[] = [];
      if (road) parts.push(houseNumber ? `${road} ${houseNumber}` : road);
      if (city) parts.push(city);

      if (parts.length > 0) {
        setAddress(parts.join(", "));
      } else {
        setAddress(first?.formatted_address || fallbackLabel?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setAddress(fallbackLabel?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  }, [fallbackLabel]);

  const placeMarker = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
    } else {
      markerRef.current = new google.maps.Marker({ map, position: { lat, lng } });
    }

    setPin({ lat, lng });
    setAddress(null);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const g = await loadGoogleMaps();
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center = { lat: initialLat ?? 32.08, lng: initialLng ?? 34.78 };
      const zoom = initialLat != null ? 15 : 8;

      const map = new g.maps.Map(containerRef.current, {
        center,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      mapRef.current = map;

      if (initialLat != null && initialLng != null) {
        markerRef.current = new g.maps.Marker({ map, position: center });
        reverseGeocode(initialLat, initialLng);
      }

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) placeMarker(e.latLng.lat(), e.latLng.lng());
      });
    })();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">לחץ על המפה לסימון המיקום</p>
      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden border border-border"
        style={{ height: 220, width: "100%" }}
      />

      {pin && (
        <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs truncate">{address}</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="text-xs flex-1"
          onClick={() => pin && address && onConfirm({ latitude: pin.lat, longitude: pin.lng, address })}
          disabled={!pin || !address || loading}
        >
          אשר מיקום
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapPinPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (result: { latitude: number; longitude: number; address: string }) => void;
  onCancel: () => void;
}

export function MapPinPicker({ initialLat, initialLng, onConfirm, onCancel }: MapPinPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=he&addressdetails=1`
      );
      const data = await res.json();
      const a = data.address;
      if (a) {
        const city = a.city || a.town || a.village || "";
        const parts: string[] = [];
        if (a.road) parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
        if (city) parts.push(city);
        if (parts.length > 0) {
          setAddress(parts.join(", "));
          setLoading(false);
          return;
        }
      }
      setAddress(data.display_name?.split(",").slice(0, 3).join(",").trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const placeMarker = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    setPin({ lat, lng });
    setAddress(null);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = [initialLat ?? 32.08, initialLng ?? 34.78];
    const zoom = initialLat != null ? 15 : 8;

    const map = L.map(containerRef.current, { attributionControl: false }).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    if (initialLat != null && initialLng != null) {
      markerRef.current = L.marker([initialLat, initialLng]).addTo(map);
      reverseGeocode(initialLat, initialLng);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
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

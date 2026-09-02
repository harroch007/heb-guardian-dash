import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name?: string;
}

// Custom Kippy-purple teardrop pin, as an inline SVG data URI (no external icon assets).
const kippyPinIcon = (): google.maps.Icon => ({
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path d="M16 2C9.4 2 4 7.4 4 14c0 9.4 12 16 12 16s12-6.6 12-16c0-6.6-5.4-12-12-12z"
              fill="hsl(263 70% 60%)" stroke="white" stroke-width="2.5"/>
        <circle cx="16" cy="14" r="4.5" fill="white"/>
      </svg>
    `),
  scaledSize: new google.maps.Size(32, 32),
  anchor: new google.maps.Point(16, 30),
});

export function LocationMap({ latitude, longitude, name }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const g = await loadGoogleMaps();
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new g.maps.Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        scrollwheel: false,
        clickableIcons: false,
      });

      markerRef.current = new g.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        icon: kippyPinIcon(),
        title: name,
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker/view when coordinates change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setPosition({ lat: latitude, lng: longitude });
    mapRef.current.setCenter({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="h-[140px] sm:h-[180px] md:h-[220px] w-full rounded-xl overflow-hidden border border-border"
      aria-label={name ? `מיקום ${name}` : "מפת מיקום"}
    />
  );
}

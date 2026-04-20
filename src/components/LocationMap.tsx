import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name?: string;
}

// Custom Kippy-purple pin (SVG, no external icon assets)
const kippyIcon = L.divIcon({
  className: "kippy-map-pin",
  html: `
    <div style="
      width: 32px; height: 32px;
      background: hsl(263 70% 60%);
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 10px; height: 10px;
        background: white;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

export function LocationMap({ latitude, longitude, name }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([latitude, longitude], 16);

    // CartoDB Voyager — illustrated, soft, Wolt/Gett-like aesthetic
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);

    markerRef.current = L.marker([latitude, longitude], { icon: kippyIcon }).addTo(map);
    if (name) markerRef.current.bindTooltip(name, { direction: "top", offset: [0, -28] });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker/view when coordinates change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
    mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="h-[140px] sm:h-[180px] md:h-[220px] w-full rounded-xl overflow-hidden border border-border"
      aria-label={name ? `מיקום ${name}` : "מפת מיקום"}
    />
  );
}

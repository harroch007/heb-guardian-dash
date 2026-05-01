import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  children: ChildWithData[];
}

const formatLastSeen = (ts: string | null): string => {
  if (!ts) return "לא זמין";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return "עכשיו";
  if (diff < 60) return `לפני ${diff} דק׳`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
};

const isConnected = (lastSeen: string | null) => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 24 * 60 * 60 * 1000;
};

const makePin = (initial: string, connected: boolean) => {
  const color = connected ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
  return L.divIcon({
    className: "kippy-family-pin",
    html: `
      <div style="
        position: relative;
        width: 36px; height: 36px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 700;
          font-size: 14px;
          font-family: system-ui, sans-serif;
        ">${initial}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
  });
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const FamilyLocationsMap = ({ children }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const didInitialFitRef = useRef(false);

  // Stable signature so the effect only runs when actual location/connection
  // data changes — not on every parent refetch.
  const locatedKey = children
    .map(
      (c) =>
        `${c.id}|${c.device?.lat ?? ""}|${c.device?.lon ?? ""}|${c.device?.last_seen ?? ""}|${c.name}|${c.device?.address ?? ""}`,
    )
    .join(",");

  const located = useMemo(() => {
    return children
      .filter((c) => c.device?.lat != null && c.device?.lon != null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.device!.lat!,
        lon: c.device!.lon!,
        address: c.device!.address ?? null,
        lastSeen: c.device!.last_seen,
        connected: isConnected(c.device!.last_seen),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatedKey]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([31.7683, 35.2137], 8); // Israel default

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20 },
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      didInitialFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();

    located.forEach((c) => {
      seen.add(c.id);
      const popupHtml = `<div dir="rtl" style="font-family: system-ui, sans-serif; min-width: 140px;">
           <div style="font-weight:700;font-size:13px;color:#111;">${escapeHtml(c.name)}</div>
           ${c.address ? `<div style="font-size:11px;color:#555;margin-top:2px;">${escapeHtml(c.address)}</div>` : ""}
           <div style="font-size:11px;color:#888;margin-top:4px;">${formatLastSeen(c.lastSeen)}</div>
         </div>`;

      const existing = markersRef.current.get(c.id);
      if (existing) {
        existing.setLatLng([c.lat, c.lon]);
        existing.setIcon(makePin(c.name.charAt(0), c.connected));
        existing.setPopupContent(popupHtml);
      } else {
        const marker = L.marker([c.lat, c.lon], {
          icon: makePin(c.name.charAt(0), c.connected),
        }).addTo(map);
        marker.bindPopup(popupHtml);
        markersRef.current.set(c.id, marker);
      }
    });

    // Remove markers no longer present
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // Fit/center only ONCE — never override the user's zoom/pan on refetches.
    if (!didInitialFitRef.current && located.length > 0) {
      const latlngs = located.map((c) => [c.lat, c.lon] as L.LatLngExpression);
      if (latlngs.length === 1) {
        map.setView(latlngs[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 15 });
      }
      didInitialFitRef.current = true;
    }
  }, [located]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">מיקום הילדים</h3>
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
        <div
          ref={containerRef}
          className="h-[260px] w-full"
          aria-label="מפת מיקומי הילדים"
        />
        {located.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/85 pointer-events-none">
            <p className="text-xs text-muted-foreground">אין מיקום זמין לאף ילד</p>
          </div>
        )}
      </div>
      {located.length > 0 && (
        <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            מחובר
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            לא מחובר (מיקום אחרון)
          </span>
        </div>
      )}
    </div>
  );
};

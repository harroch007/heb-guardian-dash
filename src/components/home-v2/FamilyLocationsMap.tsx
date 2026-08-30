import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapPin } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";
import { hasCurrentDeviceReport } from "@/lib/v2/guardianMonitoringService";
import { loadGoogleMaps } from "@/lib/googleMaps";

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

const makePinIcon = (initial: string, connected: boolean): google.maps.Icon => {
  const color = connected ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <path d="M18 2C10.8 2 5 7.8 5 15c0 10.6 13 19 13 19s13-8.4 13-19c0-7.2-5.8-13-13-13z"
                fill="${color}" stroke="white" stroke-width="2.5"/>
          <text x="18" y="19" text-anchor="middle" font-family="system-ui, sans-serif"
                font-size="14" font-weight="700" fill="white">${initial}</text>
        </svg>
      `),
    scaledSize: new google.maps.Size(36, 36),
    anchor: new google.maps.Point(18, 34),
  };
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const didInitialFitRef = useRef(false);
  const readyRef = useRef(false);

  // Stable signature so the effect only runs when actual location/connection
  // data changes — not on every parent refetch.
  const locatedKey = children
    .map(
      (c) =>
        `${c.id}|${c.device?.lat ?? ""}|${c.device?.lon ?? ""}|${c.device?.last_seen ?? ""}|${c.device?.monitoring_state ?? ""}|${c.name}|${c.device?.address ?? ""}`,
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
        connected: hasCurrentDeviceReport(c.device!.monitoring_state),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatedKey]);

  const renderMarkers = useCallback(() => {
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
        existing.setPosition({ lat: c.lat, lng: c.lon });
        existing.setIcon(makePinIcon(c.name.charAt(0), c.connected));
        google.maps.event.clearListeners(existing, "click");
        existing.addListener("click", () => {
          infoWindowRef.current?.setContent(popupHtml);
          infoWindowRef.current?.open({ map, anchor: existing });
        });
      } else {
        const marker = new google.maps.Marker({
          map,
          position: { lat: c.lat, lng: c.lon },
          icon: makePinIcon(c.name.charAt(0), c.connected),
        });
        marker.addListener("click", () => {
          infoWindowRef.current?.setContent(popupHtml);
          infoWindowRef.current?.open({ map, anchor: marker });
        });
        markersRef.current.set(c.id, marker);
      }
    });

    // Remove markers no longer present
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    // Fit/center only ONCE — never override the user's zoom/pan on refetches.
    if (!didInitialFitRef.current && located.length > 0) {
      if (located.length === 1) {
        map.setCenter({ lat: located[0].lat, lng: located[0].lon });
        map.setZoom(15);
      } else {
        const bounds = new google.maps.LatLngBounds();
        located.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lon }));
        map.fitBounds(bounds, 40);
      }
      didInitialFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const g = await loadGoogleMaps();
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new g.maps.Map(containerRef.current, {
        center: { lat: 31.7683, lng: 35.2137 }, // Israel default
        zoom: 8,
        disableDefaultUI: true,
        zoomControl: true,
        scrollwheel: false,
        clickableIcons: false,
      });

      mapRef.current = map;
      infoWindowRef.current = new g.maps.InfoWindow();
      readyRef.current = true;
      renderMarkers();
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      for (const marker of markersRef.current.values()) marker.setMap(null);
      markersRef.current.clear();
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
      didInitialFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    renderMarkers();
  }, [located, renderMarkers]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">מיקום הילדים</h3>
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
        <div
          ref={containerRef}
          className="h-[195px] sm:h-[260px] w-full"
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

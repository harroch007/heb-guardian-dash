import { useState, type ReactNode } from "react";
import { MapPin, ChevronDown, ChevronUp, Copy, Loader2, AlertTriangle, Volume2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocationMap } from "@/components/LocationMap";
import { formatLastSeen } from "@/lib/deviceStatus";
import { toast as sonnerToast } from "sonner";
import type { RingPhase } from "@/hooks/useRingCommand";
import { gt } from "@/lib/genderText";

interface LocationSectionV2Props {
  device: {
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    last_seen: string | null;
  };
  childName: string;
  childGender?: string | null;
  locateStatus: "idle" | "locating" | "success" | "failed";
  showMap: boolean;
  setShowMap: (v: boolean) => void;
  handleLocateNow: () => void;
  getLocateButtonContent: () => React.ReactNode;
  ringPhase: RingPhase;
  handleRingDevice: () => void;
  handleRetryRing: () => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children?: ReactNode;
}

export function LocationSectionV2({
  device,
  childName,
  childGender,
  locateStatus,
  showMap,
  setShowMap,
  handleLocateNow,
  getLocateButtonContent,
  ringPhase,
  handleRingDevice,
  handleRetryRing,
  expanded: controlledExpanded,
  onExpandedChange,
  children,
}: LocationSectionV2Props) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;

  const hasLocation = device.latitude !== null && device.longitude !== null;

  const isRingBusy = ringPhase === "sending" || ringPhase === "ringing";
  const isRingTerminalSuccess = ringPhase === "child_stopped" || ringPhase === "timeout" || ringPhase === "completed_legacy";
  const isRingFailed = ringPhase === "failed";

  const getRingButtonContent = () => {
    switch (ringPhase) {
      case "sending":
        return (<><Loader2 className="w-4 h-4 animate-spin ml-1.5" />שולח...</>);
      case "ringing":
        return (<><Volume2 className="w-4 h-4 ml-1.5 animate-pulse" />מצלצל...</>);
      case "child_stopped":
        return (<><CheckCircle2 className="w-4 h-4 ml-1.5 text-success" />{gt(childGender, "הילד עצר ✓", "הילדה עצרה ✓")}</>);
      case "timeout":
      case "completed_legacy":
        return (<><CheckCircle2 className="w-4 h-4 ml-1.5 text-success" />הצלצול הסתיים ✓</>);
      case "failed":
        return (<><AlertTriangle className="w-4 h-4 ml-1.5" />נכשל — נסה שוב</>);
      default:
        return (<><Volume2 className="w-4 h-4 ml-1.5" />קרא למכשיר</>);
    }
  };

  return (
    <div id="location-section" className="scroll-mt-4">
      <Card className="protection-panel border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 text-right">
                <CardTitle className="text-sm font-semibold">מיקום וגבולות גזרה</CardTitle>
                <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                  {hasLocation ? device.address || "מיקום אחרון זמין" : "אין מידע על מיקום"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={(e) => { e.stopPropagation(); handleLocateNow(); }}
                size="sm"
                variant={locateStatus === "failed" ? "destructive" : "outline"}
                disabled={locateStatus === "locating"}
                className="flex-1"
              >
                {getLocateButtonContent()}
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isRingFailed) {
                    handleRetryRing();
                  } else {
                    handleRingDevice();
                  }
                }}
                size="sm"
                variant={isRingFailed ? "destructive" : isRingTerminalSuccess ? "outline" : "default"}
                disabled={isRingBusy || isRingTerminalSuccess}
                className="flex-1"
              >
                {getRingButtonContent()}
              </Button>
            </div>

            {locateStatus === "locating" && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">מאתר את המכשיר...</p>
                <p className="text-xs text-muted-foreground">זה עשוי לקחת עד 2 דקות</p>
              </div>
            )}

            {ringPhase === "sending" && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">שולח פקודת צלצול...</p>
              </div>
            )}
            {ringPhase === "ringing" && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center gap-2">
                <Volume2 className="w-8 h-8 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">המכשיר מצלצל עכשיו</p>
                <p className="text-xs text-muted-foreground">ממתין לתגובה...</p>
              </div>
            )}

            {locateStatus === "failed" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">לא ניתן להתחבר למכשיר. ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט.</p>
              </div>
            )}

            {isRingFailed && locateStatus !== "failed" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">לא ניתן לצלצל למכשיר. ייתכן שהמכשיר לא מחובר.</p>
              </div>
            )}

            {hasLocation && locateStatus !== "locating" && (
              <>
                {showMap && (
                  <div className="animate-fade-in">
                    <LocationMap latitude={device.latitude!} longitude={device.longitude!} name={childName} />
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${device.latitude},${device.longitude}`); sonnerToast.success("המיקום הועתק!"); }}>
                        <Copy className="w-3.5 h-3.5 ml-1.5" />העתק
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`} target="_blank" rel="noopener noreferrer">
                          <MapPin className="w-3.5 h-3.5 ml-1.5" />מפות
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
                {!showMap && locateStatus !== "failed" && (
                  <div className="space-y-1">
                    <p className="text-sm text-foreground">{device.address || "מיקום ידוע"}</p>
                    <Button variant="ghost" size="sm" className="text-xs text-primary"
                      onClick={(e) => { e.stopPropagation(); setShowMap(true); }}>הצג מפה</Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">עודכן: {formatLastSeen(device.last_seen)}</p>
              </>
            )}

            {!hasLocation && device.address && locateStatus !== "locating" && locateStatus !== "failed" && (
              <div className="space-y-1">
                <p className="text-sm text-foreground">{device.address}</p>
                <p className="text-xs text-muted-foreground">
                  המכשיר דיווח על כתובת אך ללא קואורדינטות מדויקות. ייתכן שאין הרשאת מיקום מדויק או שה-GPS כבוי.
                </p>
                {device.last_seen && (
                  <p className="text-xs text-muted-foreground">עודכן: {formatLastSeen(device.last_seen)}</p>
                )}
              </div>
            )}

            {!hasLocation && !device.address && locateStatus !== "locating" && locateStatus !== "failed" && (
              <p className="text-muted-foreground text-sm text-center py-2">אין מיקום זמין</p>
            )}
            {children && <div className="border-t border-border pt-4">{children}</div>}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

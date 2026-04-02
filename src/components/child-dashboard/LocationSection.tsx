import { useState } from "react";
import { MapPin, ChevronDown, ChevronUp, Copy, Loader2, AlertTriangle, LocateFixed, Volume2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocationMap } from "@/components/LocationMap";
import { formatLastSeen } from "@/lib/deviceStatus";
import { toast as sonnerToast } from "sonner";
import type { RingPhase } from "@/hooks/useRingCommand";

interface LocationSectionProps {
  device: {
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    last_seen: string | null;
  };
  childName: string;
  locateStatus: "idle" | "locating" | "success" | "failed";
  showMap: boolean;
  setShowMap: (v: boolean) => void;
  handleLocateNow: () => void;
  getLocateButtonContent: () => React.ReactNode;
  handleRingDevice: () => void;
  // V2 enhanced ring props
  ringPhase?: RingPhase;
  handleRetryRing?: () => void;
  // Legacy prop (live app)
  ringStatus?: "idle" | "locating" | "success" | "failed";
}

export function LocationSection({
  device,
  childName,
  locateStatus,
  showMap,
  setShowMap,
  handleLocateNow,
  getLocateButtonContent,
  ringPhase: ringPhaseProp,
  handleRingDevice,
  handleRetryRing,
  ringStatus,
}: LocationSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // Map legacy ringStatus to RingPhase for backward compat
  const ringPhase: RingPhase = ringPhaseProp ?? (
    ringStatus === "locating" ? "sending" :
    ringStatus === "success" ? "completed_legacy" :
    ringStatus === "failed" ? "failed" : "idle"
  );

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
        return (<><CheckCircle2 className="w-4 h-4 ml-1.5 text-success" />הילד עצר ✓</>);
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
      <Card className="border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              מיקום
            </CardTitle>
            <div className="flex items-center gap-2">
              {!expanded && hasLocation && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {device.address || "מיקום ידוע"}
                </span>
              )}
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
            {/* Action buttons row */}
            <div className="flex gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLocateNow();
                }}
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
                  isRingFailed ? handleRetryRing() : handleRingDevice();
                }}
                size="sm"
                variant={isRingFailed ? "destructive" : isRingTerminalSuccess ? "outline" : "default"}
                disabled={isRingBusy || isRingTerminalSuccess}
                className="flex-1"
              >
                {getRingButtonContent()}
              </Button>
            </div>

            {/* Locating spinner */}
            {locateStatus === "locating" && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">מאתר את המכשיר...</p>
                <p className="text-xs text-muted-foreground">זה עשוי לקחת עד 2 דקות</p>
              </div>
            )}

            {/* Ringing feedback */}
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

            {/* Failure notice */}
            {locateStatus === "failed" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  לא ניתן להתחבר למכשיר. ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט.
                </p>
              </div>
            )}

            {/* Ring failure notice */}
            {isRingFailed && locateStatus !== "failed" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  לא ניתן לצלצל למכשיר. ייתכן שהמכשיר לא מחובר.
                </p>
              </div>
            )}

            {/* Map */}
            {hasLocation && locateStatus !== "locating" && (
              <>
                {showMap && (
                  <div className="animate-fade-in">
                    <LocationMap
                      latitude={device.latitude!}
                      longitude={device.longitude!}
                      name={childName}
                    />
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(
                            `${device.latitude},${device.longitude}`
                          );
                          sonnerToast.success("המיקום הועתק!");
                        }}
                      >
                        <Copy className="w-3.5 h-3.5 ml-1.5" />
                        העתק
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="w-3.5 h-3.5 ml-1.5" />
                          מפות
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
                {!showMap && locateStatus !== "failed" && (
                  <div className="space-y-1">
                    <p className="text-sm text-foreground">
                      {device.address || "מיקום ידוע"}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMap(true);
                      }}
                    >
                      הצג מפה
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  עודכן: {formatLastSeen(device.last_seen)}
                </p>
              </>
            )}

            {!hasLocation && locateStatus !== "locating" && locateStatus !== "failed" && (
              <p className="text-muted-foreground text-sm text-center py-2">
                אין מיקום זמין
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Battery, MapPin, Wifi, WifiOff, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getDeviceStatus, formatLastSeen } from "@/lib/deviceStatus";
import { LocationMap } from "@/components/LocationMap";
import { Progress } from "@/components/ui/progress";

interface Device {
  battery_level: number | null;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface QuickStatusCardProps {
  device?: Device;
  childName: string;
}

export const QuickStatusCard = ({ device, childName }: QuickStatusCardProps) => {
  const [showMap, setShowMap] = useState(false);
  const [progress, setProgress] = useState(100);
  
  const status = device ? getDeviceStatus(device.last_seen) : 'not_connected';
  const isConnected = status === 'connected';
  const hasLocation = device?.latitude && device?.longitude;

  // Auto-close after 10 seconds with progress animation
  useEffect(() => {
    if (showMap) {
      setProgress(100);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev <= 0) {
            setShowMap(false);
            return 0;
          }
          return prev - 1;
        });
      }, 100); // 100ms * 100 steps = 10 seconds

      return () => clearInterval(interval);
    }
  }, [showMap]);

  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-muted-foreground';
    if (level <= 20) return 'text-destructive';
    if (level <= 40) return 'text-warning';
    return 'text-success';
  };

  const getBatteryIcon = (level: number | null) => {
    if (!level) return '—';
    return `${level}%`;
  };

  const handleLocationClick = () => {
    if (hasLocation) {
      setShowMap(true);
    }
  };

  return (
    <>
      <Card className="p-4 bg-card border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{childName}</h3>
          <div className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full",
            isConnected 
              ? "bg-success/10 text-success" 
              : "bg-muted text-muted-foreground"
          )}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isConnected ? 'מחובר' : 'לא מחובר'}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Battery */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <Battery className={cn("w-5 h-5 mb-1", getBatteryColor(device?.battery_level ?? null))} />
            <span className={cn("text-sm font-medium", getBatteryColor(device?.battery_level ?? null))}>
              {getBatteryIcon(device?.battery_level ?? null)}
            </span>
            <span className="text-xs text-muted-foreground">סוללה</span>
          </div>

          {/* Location - Clickable */}
          <button
            onClick={handleLocationClick}
            disabled={!hasLocation}
            className={cn(
              "flex flex-col items-center p-3 rounded-lg bg-muted/30 transition-colors",
              hasLocation && "cursor-pointer hover:bg-muted/50 active:bg-muted/70"
            )}
            title={hasLocation ? "לחץ לצפייה במפה" : undefined}
          >
            <MapPin className={cn("w-5 h-5 mb-1", hasLocation ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm font-medium", hasLocation ? "text-foreground" : "text-muted-foreground")}>
              {hasLocation ? 'ידוע' : '—'}
            </span>
            <span className="text-xs text-muted-foreground">מיקום</span>
          </button>

          {/* Last Seen */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <Clock className="w-5 h-5 mb-1 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground truncate max-w-full">
              {device?.last_seen ? formatLastSeen(device.last_seen).replace('נראה ', '') : '—'}
            </span>
            <span className="text-xs text-muted-foreground">עדכון</span>
          </div>
        </div>
      </Card>

      {/* Map Dialog */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden" dir="rtl">
          <div className="p-4 pb-2">
            <h3 className="text-lg font-semibold text-foreground">מיקום {childName}</h3>
            <p className="text-sm text-muted-foreground">נסגר אוטומטית בעוד {Math.ceil(progress / 10)} שניות</p>
          </div>
          <div className="px-4">
            <Progress value={progress} className="h-1" />
          </div>
          <div className="p-4 pt-3">
            {hasLocation && (
              <LocationMap 
                latitude={device!.latitude!} 
                longitude={device!.longitude!}
                name={childName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

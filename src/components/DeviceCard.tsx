import { forwardRef, useState } from "react";
import { Battery, MapPin, Clock, Wifi, Copy, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LocationMap } from "@/components/LocationMap";
import { UpgradeModal } from "@/components/UpgradeModal";

interface Device {
  device_id: string;
  child_id: string | null;
  battery_level: number | null;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
  children?: {
    id: string;
    name: string;
    parent_id: string;
    subscription_tier: string | null;
  };
}

interface DeviceCardProps {
  device: Device;
}

export const DeviceCard = forwardRef<HTMLDivElement, DeviceCardProps>(function DeviceCard({ device }, ref) {
  const batteryLevel = device.battery_level ?? 0;
  const [showMap, setShowMap] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const handleLocateNow = () => {
    if (device.latitude && device.longitude) {
      setShowMap(true);
    } else {
      toast.error('אין מיקום זמין למכשיר זה');
    }
  };
  
  const getBatteryColor = (level: number) => {
    if (level > 60) return "text-success";
    if (level > 30) return "text-warning";
    return "text-destructive";
  };

  const formatLastSeen = (timestamp?: string | null) => {
    if (!timestamp) return "לא ידוע";
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  return (
    <div ref={ref} className="p-5 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 cyber-border group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10 glow-secondary">
            <Wifi className="w-5 h-5 text-success" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">
                הטלפון של {device.children?.name || 'לא מוגדר'}
              </h3>
              {device.children?.subscription_tier === 'premium' ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning border border-warning/30">
                  ⭐ פרימיום
                </span>
              ) : (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
                >
                  🆓 חינמי
                </button>
              )}
            </div>
            <p className="text-xs text-success">מחובר</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Battery */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Battery className={cn("w-4 h-4", getBatteryColor(batteryLevel))} />
            <span className="text-sm text-muted-foreground">סוללה</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  batteryLevel > 60 ? "bg-success" : batteryLevel > 30 ? "bg-warning" : "bg-destructive"
                )}
                style={{ width: `${batteryLevel}%` }}
              />
            </div>
            <span className={cn("text-sm font-medium", getBatteryColor(batteryLevel))}>
              {batteryLevel}%
            </span>
          </div>
        </div>

        {/* Last Seen */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">נצפה לאחרונה</span>
          </div>
          <span className="text-sm text-foreground">
            {formatLastSeen(device.last_seen)}
          </span>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Button
            onClick={handleLocateNow}
            className="w-full"
            size="sm"
          >
            <Navigation className="w-4 h-4 ml-2" />
            {showMap ? 'מיקום מוצג' : 'אתר עכשיו'}
          </Button>
          
          {showMap && device.latitude && device.longitude ? (
            <div className="space-y-2">
              <LocationMap 
                latitude={device.latitude} 
                longitude={device.longitude}
                height="150px"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(`${device.latitude},${device.longitude}`);
                    toast.success("המיקום הועתק!");
                  }}
                >
                  <Copy className="w-4 h-4 ml-2" />
                  העתק
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="w-4 h-4 ml-2" />
                    Maps
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-32 rounded-xl bg-muted/50 flex items-center justify-center">
              <p className="text-sm text-muted-foreground text-center">לחץ "אתר עכשיו" לראות את המיקום</p>
            </div>
          )}
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        childName={device.children?.name}
      />
    </div>
  );
});

DeviceCard.displayName = "DeviceCard";

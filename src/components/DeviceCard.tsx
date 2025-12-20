import { Battery, MapPin, Clock, Wifi, WifiOff } from "lucide-react";
import { Device } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const batteryLevel = device.battery_level ?? 0;
  const isOnline = device.status === 'online';
  
  const getBatteryColor = (level: number) => {
    if (level > 60) return "text-success";
    if (level > 30) return "text-warning";
    return "text-destructive";
  };

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return "לא ידוע";
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openMaps = () => {
    if (device.latitude && device.longitude) {
      window.open(
        `https://www.google.com/maps?q=${device.latitude},${device.longitude}`,
        '_blank'
      );
    }
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 cyber-border group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isOnline ? "bg-success/10 glow-secondary" : "bg-muted"
          )}>
            {isOnline ? (
              <Wifi className="w-5 h-5 text-success" />
            ) : (
              <WifiOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{device.name || 'מכשיר'}</h3>
            <p className="text-xs text-muted-foreground">
              {isOnline ? 'מחובר' : 'לא מחובר'}
            </p>
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
        {device.latitude && device.longitude && (
          <button
            onClick={openMaps}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-all group-hover:glow-primary"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary">צפה במיקום</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Google Maps ←
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

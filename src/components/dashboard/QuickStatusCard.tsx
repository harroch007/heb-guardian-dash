import { Battery, MapPin, Wifi, WifiOff, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDeviceStatus, getStatusColor, formatLastSeen } from "@/lib/deviceStatus";

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
  const status = device ? getDeviceStatus(device.last_seen) : 'not_connected';
  const isConnected = status === 'connected';
  const hasLocation = device?.latitude && device?.longitude;

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

  return (
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

        {/* Location */}
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
          <MapPin className={cn("w-5 h-5 mb-1", hasLocation ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium", hasLocation ? "text-foreground" : "text-muted-foreground")}>
            {hasLocation ? 'ידוע' : '—'}
          </span>
          <span className="text-xs text-muted-foreground">מיקום</span>
        </div>

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
  );
};

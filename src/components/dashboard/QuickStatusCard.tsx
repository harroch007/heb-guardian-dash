import { useState, useEffect } from "react";
import { MapPin, Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getDeviceStatus, getStatusLabel, getStatusTextColor, getStatusBgColor, getStatusDescription, formatLastSeen } from "@/lib/deviceStatus";
import { LocationMap } from "@/components/LocationMap";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

// Dynamic battery icon component with fill based on level
const DynamicBatteryIcon = ({ level, className }: { level: number | null; className?: string }) => {
  const fillPercent = level ?? 0;
  const fillColor = !level ? 'currentColor' : 
    level <= 20 ? 'hsl(var(--destructive))' : 
    level <= 40 ? 'hsl(var(--warning))' : 
    'hsl(var(--success))';
  
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {/* Battery body */}
      <rect x="2" y="7" width="18" height="10" rx="2" ry="2" />
      {/* Battery cap */}
      <path d="M22 11v2" />
      {/* Dynamic fill */}
      <motion.rect 
        x="4" 
        y="9" 
        height="6" 
        rx="1"
        fill={fillColor}
        stroke="none"
        initial={{ width: 0 }}
        animate={{ width: (fillPercent / 100) * 14 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      />
    </svg>
  );
};
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
  
  const status = getDeviceStatus(device?.last_seen ?? null);
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

  const isDataStale = status === 'inactive' || status === 'disconnected';

  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-muted-foreground';
    if (isDataStale) return 'text-muted-foreground';
    if (level <= 20) return 'text-destructive';
    if (level <= 40) return 'text-warning';
    return 'text-success';
  };

  const getBatteryIcon = (level: number | null) => {
    if (!level) return '—';
    return `${level}%`;
  };

  const getLastSeenShort = () => {
    if (!device?.last_seen) return '';
    const diff = new Date().getTime() - new Date(device.last_seen).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `לפני ${mins} דק׳`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} שע׳`;
    const days = Math.floor(hours / 24);
    return `לפני ${days} ימים`;
  };

  const handleLocationClick = () => {
    if (hasLocation) {
      setShowMap(true);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected': return <Wifi className="w-3 h-3" />;
      case 'inactive': return <AlertTriangle className="w-3 h-3" />;
      case 'disconnected': return <WifiOff className="w-3 h-3" />;
    }
  };

  return (
    <>
      <Card className={cn(
        "p-4 bg-card border-border/50",
        status === 'disconnected' && "border-destructive/50"
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{childName}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full cursor-help",
                  getStatusBgColor(status),
                  getStatusTextColor(status)
                )}>
                  {getStatusIcon()}
                  <span>{getStatusLabel(status)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{getStatusDescription(status)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Warning banner for disconnected status */}
        {status === 'disconnected' && (
          <div className="mb-3 p-2 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-destructive">
              <p className="font-medium">המכשיר לא מדווח יותר משעה</p>
              <p className="text-destructive/80">יתכן שהאפליקציה הוסרה או שהטלפון כבוי</p>
            </div>
          </div>
        )}

        {/* Warning banner for inactive status */}
        {status === 'inactive' && (
          <div className="mb-3 p-2 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning">לא התקבל עדכון ב-15 הדקות האחרונות</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {/* Battery */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className={cn(
                    "flex flex-col items-center p-2 sm:p-3 rounded-lg bg-muted/30",
                    isDataStale && "cursor-help"
                  )}
                >
                  <DynamicBatteryIcon 
                    level={isDataStale ? null : device?.battery_level ?? null} 
                    className={cn("w-5 h-5 sm:w-6 sm:h-6 mb-1", getBatteryColor(device?.battery_level ?? null))} 
                  />
                  <span className={cn("text-xs sm:text-sm font-medium", getBatteryColor(device?.battery_level ?? null))}>
                    {getBatteryIcon(device?.battery_level ?? null)}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {isDataStale ? 'אחרונה' : 'סוללה'}
                  </span>
                </motion.div>
              </TooltipTrigger>
              {isDataStale && device?.battery_level && (
                <TooltipContent side="bottom">
                  <p>נמדד {getLastSeenShort()}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Location - Clickable */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  onClick={handleLocationClick}
                  disabled={!hasLocation}
                  className={cn(
                    "flex flex-col items-center p-2 sm:p-3 rounded-lg bg-muted/30 transition-colors",
                    hasLocation && "cursor-pointer hover:bg-muted/50 active:bg-muted/70"
                  )}
                >
                  <MapPin className={cn(
                    "w-5 h-5 sm:w-6 sm:h-6 mb-1", 
                    !hasLocation ? "text-muted-foreground" : isDataStale ? "text-muted-foreground" : "text-primary"
                  )} />
                  <span className={cn(
                    "text-xs sm:text-sm font-medium", 
                    !hasLocation ? "text-muted-foreground" : isDataStale ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {hasLocation ? (isDataStale ? 'אחרון' : 'ידוע') : '—'}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">מיקום</span>
                </motion.button>
              </TooltipTrigger>
              {isDataStale && hasLocation && (
                <TooltipContent side="bottom">
                  <p>נמדד {getLastSeenShort()} • לחץ לצפייה</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Last Seen */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className={cn(
              "flex flex-col items-center p-2 sm:p-3 rounded-lg bg-muted/30",
              status === 'disconnected' && "bg-destructive/10",
              status === 'inactive' && "bg-warning/10"
            )}
          >
            <Clock className={cn(
              "w-5 h-5 sm:w-6 sm:h-6 mb-1",
              status === 'connected' && "text-muted-foreground",
              status === 'inactive' && "text-warning",
              status === 'disconnected' && "text-destructive"
            )} />
            <span className={cn(
              "text-xs sm:text-sm font-medium",
              status === 'connected' && "text-foreground",
              status === 'inactive' && "text-warning",
              status === 'disconnected' && "text-destructive"
            )}>
              {getLastSeenShort() || '—'}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">עדכון</span>
          </motion.div>
        </div>
      </Card>

      {/* Map Dialog */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden" dir="rtl">
          <div className="p-4 pb-2">
            <h3 className="text-lg font-semibold text-foreground">
              {isDataStale ? `מיקום אחרון של ${childName}` : `מיקום ${childName}`}
            </h3>
            <p className="text-sm text-muted-foreground">נסגר אוטומטית בעוד {Math.ceil(progress / 10)} שניות</p>
          </div>
          <div className="px-4">
            <Progress value={progress} className="h-1" />
          </div>
          
          {/* Stale data warning */}
          {isDataStale && (
            <div className="mx-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-warning">
                <p className="font-medium">זהו המיקום האחרון הידוע ({getLastSeenShort()})</p>
                <p className="text-warning/80">המיקום הנוכחי עשוי להיות שונה</p>
              </div>
            </div>
          )}
          
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

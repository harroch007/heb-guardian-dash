import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, Calendar, ChevronLeft, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Child {
  id: string;
  name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  city: string | null;
  school: string | null;
}

interface Device {
  device_id: string;
  last_seen: string | null;
}

interface ChildCardProps {
  child: Child;
  style?: React.CSSProperties;
}

export function ChildCard({ child, style }: ChildCardProps) {
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);

  useEffect(() => {
    const fetchDevice = async () => {
      const { data } = await supabase
        .from('devices')
        .select('device_id, last_seen')
        .eq('child_id', child.id)
        .maybeSingle();
      
      setDevice(data);
      setLoadingDevice(false);
    };

    fetchDevice();
  }, [child.id]);

  const isOnline = (() => {
    if (!device?.last_seen) return false;
    const lastSeen = new Date(device.last_seen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    return diffMs < 5 * 60 * 1000; // 5 minutes
  })();

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'boy': return 'בן';
      case 'girl': return 'בת';
      default: return 'אחר';
    }
  };

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case 'boy': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'girl': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    }
  };

  const age = calculateAge(child.date_of_birth);

  return (
    <Card 
      onClick={() => navigate(`/child/${child.id}`)}
      className="border-primary/20 bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 animate-fade-in opacity-0 group hover:glow-primary cursor-pointer"
      style={style}
    >
      <CardContent className="p-6">
        {/* Avatar & Name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 group-hover:animate-glow-pulse">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground truncate">
              {child.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full border",
                getGenderColor(child.gender)
              )}>
                {getGenderLabel(child.gender)}
              </span>
              <span className="text-muted-foreground text-sm">
                {age} שנים
              </span>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        {/* Details */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{new Date(child.date_of_birth).toLocaleDateString('he-IL')}</span>
          </div>
          
          {/* Device Status */}
          {loadingDevice ? (
            <div className="w-20 h-5 bg-muted animate-pulse rounded" />
          ) : device ? (
            <div className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full",
              isOnline ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
            )}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isOnline ? 'מחובר' : 'לא מחובר'}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">אין מכשיר</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

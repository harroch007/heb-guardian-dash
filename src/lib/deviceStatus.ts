export type DeviceStatus = 'connected' | 'inactive' | 'disconnected';

// Thresholds in minutes
const INACTIVE_THRESHOLD = 15;  // 15 minutes without update = inactive
const DISCONNECTED_THRESHOLD = 60;  // 1 hour without update = disconnected

export function getDeviceStatus(lastSeen: string | null): DeviceStatus {
  if (!lastSeen) return 'disconnected';
  
  const diff = new Date().getTime() - new Date(lastSeen).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < INACTIVE_THRESHOLD) return 'connected';
  if (minutes < DISCONNECTED_THRESHOLD) return 'inactive';
  return 'disconnected';
}

export function getStatusColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-success';
    case 'inactive': return 'bg-warning';
    case 'disconnected': return 'bg-destructive';
  }
}

export function getStatusTextColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'text-success';
    case 'inactive': return 'text-warning';
    case 'disconnected': return 'text-destructive';
  }
}

export function getStatusBgColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-success/10';
    case 'inactive': return 'bg-warning/10';
    case 'disconnected': return 'bg-destructive/10';
  }
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'מחובר';
    case 'inactive': return 'לא פעיל';
    case 'disconnected': return 'מנותק';
  }
}

export function getStatusDescription(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'המכשיר מדווח באופן תקין';
    case 'inactive': return 'לא התקבל עדכון ב-15 הדקות האחרונות';
    case 'disconnected': return 'לא התקבל עדכון יותר משעה - יתכן שהאפליקציה הוסרה';
  }
}

export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'לא זמין';
  
  const diff = new Date().getTime() - new Date(lastSeen).getTime();
  const mins = Math.floor(diff / 60000);
  
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דקות`;
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

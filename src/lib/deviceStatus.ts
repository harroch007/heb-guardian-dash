export type DeviceStatus = 'connected' | 'not_connected';

// Binary status: device exists = connected, no device = not connected
export function getDeviceStatus(hasDevice: boolean): DeviceStatus {
  return hasDevice ? 'connected' : 'not_connected';
}

export function getStatusColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-success';
    case 'not_connected': return 'bg-destructive';
  }
}

export function getStatusTextColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'text-success';
    case 'not_connected': return 'text-destructive';
  }
}

export function getStatusBgColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-success/10';
    case 'not_connected': return 'bg-destructive/10';
  }
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'מחובר';
    case 'not_connected': return 'לא מחובר';
  }
}

export function getStatusDescription(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'המכשיר מחובר לחשבון';
    case 'not_connected': return 'אין מכשיר מחובר לילד זה';
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

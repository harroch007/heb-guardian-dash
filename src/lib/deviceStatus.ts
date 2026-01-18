export type DeviceStatus = 'connected' | 'inactive' | 'not_connected';

// Check if last_seen is within 24 hours
const isRecentlyActive = (lastSeen: string | null | undefined): boolean => {
  if (!lastSeen) return false;
  const lastSeenTime = new Date(lastSeen).getTime();
  return (Date.now() - lastSeenTime) < 24 * 60 * 60 * 1000;
};

// Unified status logic - accepts whether device exists and when it was last seen
export function getDeviceStatus(hasDevice: boolean, lastSeen?: string | null): DeviceStatus {
  if (!hasDevice) return 'not_connected';
  if (isRecentlyActive(lastSeen)) return 'connected';
  return 'inactive';
}

export function getStatusColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-success';
    case 'inactive': return 'bg-warning';
    case 'not_connected': return 'bg-destructive';
  }
}

export function getStatusTextColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'text-success';
    case 'inactive': return 'text-warning';
    case 'not_connected': return 'text-destructive';
  }
}

export function getStatusBgColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-success/10';
    case 'inactive': return 'bg-warning/10';
    case 'not_connected': return 'bg-destructive/10';
  }
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'מחובר';
    case 'inactive': return 'לא פעיל';
    case 'not_connected': return 'לא מחובר';
  }
}

export function getStatusDescription(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'המכשיר מחובר לחשבון';
    case 'inactive': return 'המכשיר לא פעיל זמן רב';
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

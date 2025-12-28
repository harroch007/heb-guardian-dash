export type DeviceStatus = 'connected' | 'not_connected';

export function getDeviceStatus(lastSeen: string | null): DeviceStatus {
  if (!lastSeen) return 'not_connected';
  return 'connected';
}

export function getStatusColor(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'not_connected': return 'bg-gray-500';
  }
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'connected': return 'מחובר';
    case 'not_connected': return 'לא מחובר';
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

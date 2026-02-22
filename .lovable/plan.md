

# Fix: Family tab showing wrong device status

## Problem
Child "קיפי1" has two linked devices. The Family page builds a `devicesMap` where each child maps to one device, but it uses a simple last-write-wins approach. The stale device (last seen 27 days ago) overwrites the active device (last seen today), causing the child to appear as "לא פעיל" instead of "מחובר".

## Solution
When building `devicesMap` in `Family.tsx`, keep only the device with the **most recent** `last_seen` timestamp for each child. This ensures the active device is always displayed.

## Technical Details

**File:** `src/pages/Family.tsx`

**Current code (problematic):**
```typescript
devicesData?.forEach(device => {
  if (device.child_id) {
    devicesMap[device.child_id] = {
      device_id: device.device_id,
      battery_level: device.battery_level,
      last_seen: device.last_seen
    };
  }
});
```

**Fixed code:**
```typescript
devicesData?.forEach(device => {
  if (device.child_id) {
    const existing = devicesMap[device.child_id];
    // Keep the device with the most recent last_seen
    if (!existing || 
        (device.last_seen && (!existing.last_seen || 
         new Date(device.last_seen) > new Date(existing.last_seen)))) {
      devicesMap[device.child_id] = {
        device_id: device.device_id,
        battery_level: device.battery_level,
        last_seen: device.last_seen
      };
    }
  }
});
```

This is a single change in one file. After this fix, the Family tab will show the most recently active device for each child, correctly displaying "מחובר" for קיפי1.

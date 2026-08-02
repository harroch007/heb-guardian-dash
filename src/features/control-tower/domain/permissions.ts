import type { StaffPermission, StaffSession } from "./types";

export function hasPermission(session: StaffSession, permission: StaffPermission): boolean {
  return session.permissions.includes(permission);
}

export function canEnterInbox(session: StaffSession): boolean {
  return (
    hasPermission(session, "control_tower.access") &&
    (hasPermission(session, "inbox.read.all") || hasPermission(session, "inbox.read.assigned"))
  );
}

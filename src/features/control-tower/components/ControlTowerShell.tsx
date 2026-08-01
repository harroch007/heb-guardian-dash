import type { ReactNode } from "react";
import type { StaffSession } from "../domain/types";
import { ControlTowerHeader } from "./ControlTowerHeader";
import { FixtureBanner } from "./FixtureBanner";

interface ControlTowerShellProps {
  session: StaffSession;
  fixture: boolean;
  hasSelection: boolean;
  customerRoute: boolean;
  inbox: ReactNode;
  conversation: ReactNode;
  customer: ReactNode;
}

export function ControlTowerShell({
  session,
  fixture,
  hasSelection,
  customerRoute,
  inbox,
  conversation,
  customer,
}: ControlTowerShellProps) {
  const className = [
    "ct-shell",
    hasSelection ? "ct-shell-has-selection" : "",
    customerRoute ? "ct-shell-customer-route" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {fixture ? <FixtureBanner /> : null}
      <ControlTowerHeader session={session} />
      <div className="ct-workspace">
        <aside className="ct-inbox-panel" aria-label="תורי שירות ושיחות">{inbox}</aside>
        <main className="ct-conversation-panel" id="ct-main-content">{conversation}</main>
        <aside className="ct-customer-panel" aria-label="Customer 360">{customer}</aside>
      </div>
    </div>
  );
}

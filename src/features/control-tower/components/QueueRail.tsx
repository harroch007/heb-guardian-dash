import { CircleDollarSign, Inbox, ShieldCheck, ShoppingBag, Smartphone, UserRoundSearch } from "lucide-react";
import type { QueueId } from "../domain/types";

interface QueueRailProps {
  queues: readonly { queueId: QueueId; label: string; count: number | null }[];
  activeQueueId: QueueId | null;
  onSelect: (queueId: QueueId) => void;
}

const queueIcons = {
  all: Inbox,
  "device-ops": Smartphone,
  "identity-review": UserRoundSearch,
  sales: ShoppingBag,
  "trust-safety": ShieldCheck,
  finance: CircleDollarSign,
};

export function QueueRail({ queues, activeQueueId, onSelect }: QueueRailProps) {
  return (
    <nav className="ct-queue-rail" aria-label="תורי שירות">
      {queues.map((queue) => {
        const Icon = queueIcons[queue.queueId as keyof typeof queueIcons] ?? Inbox;
        const selected = (activeQueueId ?? "all") === queue.queueId;
        return (
          <button
            type="button"
            key={queue.queueId}
            className="ct-queue-button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onSelect(queue.queueId)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{queue.label}</span>
            <strong>{queue.count ?? "—"}</strong>
          </button>
        );
      })}
    </nav>
  );
}

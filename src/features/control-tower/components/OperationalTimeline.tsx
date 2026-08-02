import { Activity, MessageCircle, ShieldCheck, StickyNote, UserRoundCheck, Wrench } from "lucide-react";
import type { OperationalTimelineEvent } from "../domain/types";
import { formatFixtureTime } from "./presentation";

function EventIcon({ type }: { type: OperationalTimelineEvent["type"] }) {
  if (type === "MESSAGE" || type === "DELIVERY") return <MessageCircle size={14} aria-hidden="true" />;
  if (type === "VERIFICATION") return <ShieldCheck size={14} aria-hidden="true" />;
  if (type === "DIAGNOSTIC" || type === "ACTION") return <Wrench size={14} aria-hidden="true" />;
  if (type === "INTERNAL_NOTE") return <StickyNote size={14} aria-hidden="true" />;
  if (type === "HANDOFF" || type === "ASSIGNMENT") return <UserRoundCheck size={14} aria-hidden="true" />;
  return <Activity size={14} aria-hidden="true" />;
}

export function OperationalTimeline({ events }: { events: readonly OperationalTimelineEvent[] }) {
  return (
    <ol className="ct-operational-timeline" aria-label="ציר זמן תפעולי">
      {[...events].reverse().map((event) => (
        <li key={event.eventId} data-event-type={event.type}>
          <span className="ct-timeline-icon"><EventIcon type={event.type} /></span>
          <div>
            <div className="ct-timeline-topline">
              <strong>{event.summary}</strong>
              <time dateTime={event.occurredAt}>{formatFixtureTime(event.occurredAt)}</time>
            </div>
            <span>{event.actorLabel}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

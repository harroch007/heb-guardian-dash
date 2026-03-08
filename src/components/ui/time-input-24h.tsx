import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeInput24hProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function TimeInput24h({ value, onChange }: TimeInput24hProps) {
  const [h, m] = (value || "00:00").split(":");
  const hour = h || "00";
  // snap minute to nearest 5
  const rawMin = parseInt(m || "0", 10);
  const minute = MINUTES.reduce((prev, curr) =>
    Math.abs(parseInt(curr) - rawMin) < Math.abs(parseInt(prev) - rawMin) ? curr : prev
  );

  return (
    <div className="flex gap-1.5 items-center" dir="ltr">
      <Select value={hour} onValueChange={(v) => onChange(`${v}:${minute}`)}>
        <SelectTrigger className="w-[70px] h-9 text-center">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {HOURS.map((hh) => (
            <SelectItem key={hh} value={hh}>{hh}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground font-bold">:</span>
      <Select value={minute} onValueChange={(v) => onChange(`${hour}:${v}`)}>
        <SelectTrigger className="w-[70px] h-9 text-center">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {MINUTES.map((mm) => (
            <SelectItem key={mm} value={mm}>{mm}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

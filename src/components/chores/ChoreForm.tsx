import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

interface ChoreFormProps {
  onSubmit: (title: string, rewardMinutes: number, isRecurring: boolean, recurrenceDays: number[] | null) => Promise<void>;
}

export function ChoreForm({ onSubmit }: ChoreFormProps) {
  const [title, setTitle] = useState("");
  const [rewardMinutes, setRewardMinutes] = useState(10);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: number) => {
    setRecurrenceDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit(title.trim(), rewardMinutes, isRecurring, isRecurring && recurrenceDays.length > 0 ? recurrenceDays : null);
    setTitle("");
    setRewardMinutes(10);
    setIsRecurring(false);
    setRecurrenceDays([]);
    setSubmitting(false);
  };

  return (
    <Card className="border-dashed border-primary/30">
      <CardContent className="p-4 space-y-4" dir="rtl">
        <div className="flex gap-3">
          <Input
            placeholder="תיאור המשימה..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="flex-1"
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
          <div className="flex items-center gap-2 min-w-[100px]">
            <Input
              type="number"
              min={1}
              max={120}
              value={rewardMinutes}
              onChange={e => setRewardMinutes(parseInt(e.target.value) || 10)}
              className="w-16 text-center"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">דק׳</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="recurring" className="text-sm text-muted-foreground">משימה חוזרת</Label>
            <div dir="ltr">
              <Switch id="recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>
          </div>

          <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || submitting}>
            <Plus className="w-4 h-4 ml-1" />
            הוסף
          </Button>
        </div>

        {isRecurring && (
          <div className="flex gap-2 justify-center">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                  recurrenceDays.includes(i)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

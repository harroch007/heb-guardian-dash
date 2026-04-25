import { Home, Clock, Shield, Bell, CheckCircle2, BookOpen, Dog, BedDouble } from 'lucide-react';

interface PhoneMockupProps {
  variant: 'overview' | 'tasks';
}

export function PhoneMockup({ variant }: PhoneMockupProps) {
  return (
    <div className="relative mx-auto w-[200px] sm:w-[240px]">
      {/* Glow */}
      <div className="absolute -inset-6 bg-primary/20 rounded-[3rem] blur-2xl" />
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] bg-card border-[10px] border-card shadow-2xl shadow-primary/30 overflow-hidden" dir="rtl">
        {/* Notch */}
        <div className="relative h-6 bg-card flex items-center justify-center">
          <div className="w-20 h-5 bg-background rounded-b-2xl" />
        </div>
        {/* Screen */}
        <div className="bg-background px-3 pt-3 pb-2 min-h-[440px] flex flex-col">
          {variant === 'overview' ? <OverviewScreen /> : <TasksScreen />}
          <BottomNav active={variant === 'overview' ? 0 : 1} />
        </div>
      </div>
    </div>
  );
}

function OverviewScreen() {
  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">היי אבא 👋</span>
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40" />
      </div>
      <p className="text-[10px] text-muted-foreground">סקירה כללית</p>

      {/* Gauge */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * 0.35}`}
              style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.7))' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-primary">120</span>
            <span className="text-[9px] text-muted-foreground">דקות מסך</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] text-foreground">זמן מסך היום</span>
        </div>
        <span className="text-[10px] font-bold text-foreground">2.5 שעות</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
        <span className="text-[10px] text-foreground">אפליקציות</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-red-500/80" />
          <div className="w-4 h-4 rounded bg-pink-500/80" />
          <div className="w-4 h-4 rounded bg-cyan-500/80" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
        <span className="text-[10px] text-foreground">בקשות זמן</span>
        <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">2</span>
      </div>
    </div>
  );
}

function TasksScreen() {
  const tasks = [
    { icon: BedDouble, title: 'סידור החדר', mins: 20, done: true },
    { icon: Dog, title: 'הוצאה לכלב', mins: 15, done: true },
    { icon: BookOpen, title: 'קריאה 20 דק', mins: 15, done: true },
  ];
  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">הצלחת! 🎉</span>
        <div className="w-7 h-7 rounded-full bg-success/20 border border-success/40" />
      </div>

      <div className="bg-success/10 border border-success/40 rounded-2xl p-4 text-center">
        <p className="text-[10px] text-success-foreground/80 mb-1">המשימות שלי</p>
        <p className="text-2xl font-bold text-success-foreground">120</p>
        <p className="text-[10px] text-success-foreground/80">דקות בבנק</p>
      </div>

      <p className="text-[10px] text-muted-foreground">המשימות שלי להיום</p>

      {tasks.map(({ icon: Icon, title, mins, done }) => (
        <div key={title} className="bg-card border border-border rounded-xl p-2.5 flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground truncate">{title}</p>
            <p className="text-[9px] text-primary">+{mins} דק'</p>
          </div>
          {done && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function BottomNav({ active }: { active: number }) {
  const items = [
    { icon: Home, label: 'בית' },
    { icon: CheckCircle2, label: 'משימות' },
    { icon: Shield, label: 'בקרה' },
    { icon: Bell, label: 'התראות' },
  ];
  return (
    <div className="mt-3 -mx-3 px-3 pt-2 border-t border-border flex justify-around">
      {items.map(({ icon: Icon, label }, i) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <Icon className={`w-4 h-4 ${i === active ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-[8px] ${i === active ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

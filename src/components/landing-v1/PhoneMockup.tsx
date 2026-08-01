import {
  Activity,
  Battery,
  Bell,
  Home,
  MessageCircle,
  Mic,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface PhoneMockupProps {
  variant: 'overview' | 'controls';
}

export function PhoneMockup({ variant }: PhoneMockupProps) {
  return (
    <div className="relative mx-auto w-[200px] sm:w-[240px]">
      <div className="absolute -inset-6 bg-primary/20 rounded-[3rem] blur-2xl" />
      <div className="relative rounded-[2.5rem] bg-card border-[10px] border-card shadow-2xl shadow-primary/30 overflow-hidden" dir="rtl">
        <div className="relative h-6 bg-card flex items-center justify-center">
          <div className="w-20 h-5 bg-background rounded-b-2xl" />
        </div>
        <div className="bg-background px-3 pt-3 pb-2 min-h-[440px] flex flex-col">
          {variant === 'overview' ? <OverviewScreen /> : <ProtectionScreen />}
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

function OverviewScreen() {
  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">מרכז ההגנה</span>
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40" />
      </div>
      <p className="text-[10px] text-muted-foreground">ניטור WhatsApp</p>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="text-[11px] font-bold text-foreground">2 מכשירים מנוטרים</span>
          </div>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] text-success">תקין</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-background p-2">
            <p className="text-[9px] text-muted-foreground">ניטור פעיל</p>
            <p className="text-sm font-bold text-foreground">2 מתוך 2</p>
          </div>
          <div className="rounded-lg bg-background p-2">
            <p className="text-[9px] text-muted-foreground">התראות חדשות</p>
            <p className="text-sm font-bold text-primary">1</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] text-foreground">נועם · WhatsApp</span>
        </div>
        <span className="text-[10px] font-bold text-success">פעיל</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Battery className="w-3.5 h-3.5 text-success" />
          <span className="text-[10px] text-foreground">מצב סוללה</span>
        </div>
        <span className="text-[9px] text-muted-foreground">82%</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-warning" />
          <span className="text-[10px] text-foreground">הרשאות הניטור</span>
        </div>
        <span className="text-[9px] font-bold text-warning">3 מתוך 4</span>
      </div>
    </div>
  );
}

function ProtectionScreen() {
  const areas = [
    { icon: MessageCircle, title: 'הודעות טקסט', value: 'נבדקות בהקשר' },
    { icon: Mic, title: 'הודעות קוליות', value: 'תמלול מהיר ומדויק' },
    { icon: ShieldCheck, title: 'שתי שכבות מקומיות', value: 'המידע נשאר במכשיר' },
    { icon: Bell, title: 'התראות מאומתות', value: 'רק כשנדרשת התערבות' },
  ];

  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-xs font-bold text-foreground">מרכז ההגנה של נועם</span>
          <span className="text-[9px] text-muted-foreground">מחובר עכשיו · 82% סוללה</span>
        </div>
        <ShieldCheck className="h-5 w-5 text-success" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {areas.map(({ icon: Icon, title, value }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-2.5">
            <Icon className="mb-2 h-4 w-4 text-primary" />
            <p className="text-[10px] font-bold text-foreground">{title}</p>
            <p className="mt-0.5 text-[8px] text-muted-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-success/30 bg-success/10 p-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-success" />
          <div>
            <p className="text-[10px] font-bold text-foreground">הניטור פעיל</p>
            <p className="text-[8px] text-muted-foreground">כל ארבע הרשאות ההגנה פעילות</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomNav() {
  const items = [
    { icon: Home, label: 'בית', active: true },
    { icon: Users, label: 'משפחה', active: false },
    { icon: Bell, label: 'התראות', active: false },
    { icon: Settings, label: 'הגדרות', active: false },
  ];
  return (
    <div className="mt-3 -mx-3 px-3 pt-2 border-t border-border flex justify-around">
      {items.map(({ icon: Icon, label, active }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-[8px] ${active ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

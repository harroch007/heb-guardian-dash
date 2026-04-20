import { Zap, Globe, Smartphone } from 'lucide-react';

export function TrustBar() {
  const items = [
    { icon: Zap, label: 'התקנה ב-3 דקות' },
    { icon: Globe, label: 'עברית מלאה ו-RTL' },
    { icon: Smartphone, label: 'עובד על כל אנדרואיד' },
  ];

  return (
    <section className="py-8 bg-white border-y border-border" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <span className="font-semibold text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

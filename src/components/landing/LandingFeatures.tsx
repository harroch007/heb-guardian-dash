import { Shield, UserX, AlertTriangle } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: "הגנה מפני בריונות רשת",
    description: "זיהוי חרם, שיח פוגע ולחץ חברתי"
  },
  {
    icon: UserX,
    title: "זיהוי זרים מסוכנים",
    description: "התרעה כשמישהו לא מוכר יוצר קשר"
  },
  {
    icon: AlertTriangle,
    title: "תוכן לא הולם",
    description: "זיהוי שיחות אלימות, מיניות או סמים"
  }
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          למה הורים בוחרים ב-<span className="text-primary text-glow">Kippy</span>
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-8 text-center hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

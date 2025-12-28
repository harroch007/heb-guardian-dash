import { MessageCircle, Send, Gamepad2, Music, Instagram } from 'lucide-react';

const platforms = [
  { name: 'WhatsApp', icon: MessageCircle },
  { name: 'Telegram', icon: Send },
  { name: 'Discord', icon: Gamepad2 },
  { name: 'TikTok', icon: Music },
  { name: 'Instagram', icon: Instagram },
];

export function LandingPlatforms() {
  return (
    <section className="py-16 border-b border-border">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-foreground">
          מגנים על הילדים שלכם בכל הפלטפורמות
        </h2>
        
        <div className="flex justify-center items-center gap-8 md:gap-12 flex-wrap mb-8">
          {platforms.map((platform, index) => (
            <div 
              key={index}
              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <platform.icon className="w-10 h-10 md:w-12 md:h-12" />
              <span className="text-sm font-medium">{platform.name}</span>
            </div>
          ))}
        </div>
        
        <p className="text-center text-muted-foreground text-lg">
          אפליקציה אחת. הגנה מלאה.
        </p>
      </div>
    </section>
  );
}

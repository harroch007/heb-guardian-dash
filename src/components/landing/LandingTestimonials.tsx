import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "Kippy הצילה את הבת שלי מחרם קשה בכיתה. קיבלתי התרעה בדיוק בזמן והצלחתי להתערב לפני שזה הרס לה את השנה.",
    name: "רחל",
    location: "תל אביב"
  },
  {
    quote: "כהורה חרדי, חיפשתי פתרון שמגן אבל לא פולש. Kippy עושה את זה בדיוק נכון - הבן שלי מוגן ואני שקט.",
    name: "דוד",
    location: "ירושלים"
  },
  {
    quote: "הבן שלי בן 13 וחשבתי שהוא יהיה נגד. הוא הבין שזה לא מעקב אלא הגנה, והוא רגוע. אני גם.",
    name: "יעל",
    location: "חיפה"
  },
  {
    quote: "Kippy נותנת לי שקט נפשי שאני לא יכולה למדוד בכסף. לדעת שמישהו שומר על הילדים גם כשאני לא יכולה.",
    name: "ענת",
    location: "באר שבע"
  }
];

export function LandingTestimonials() {
  return (
    <section className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          מה ההורים <span className="text-primary text-glow">אומרים</span>
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-primary/40 mb-4" />
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-border pt-4">
                <p className="font-semibold text-foreground">{testimonial.name}</p>
                <p className="text-sm text-muted-foreground">{testimonial.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

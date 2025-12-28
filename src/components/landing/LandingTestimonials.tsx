import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const testimonials = [
  {
    quote: "Kippy הצילה את הבת שלי מחרם קשה בכיתה. קיבלתי התרעה בדיוק בזמן והצלחתי להתערב לפני שזה הרס לה את השנה.",
    name: "רחל כהן",
    location: "תל אביב",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
    rating: 5
  },
  {
    quote: "כהורה חרדתי, חיפשתי פתרון שמגן אבל לא פולש. Kippy עושה את זה בדיוק נכון - הבן שלי מוגן ואני שקט.",
    name: "דוד לוי",
    location: "ירושלים",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    rating: 5
  },
  {
    quote: "הבן שלי בן 13 וחשבתי שהוא יהיה נגד. הוא הבין שזה לא מעקב אלא הגנה, והוא רגוע. אני גם.",
    name: "יעל אברהם",
    location: "חיפה",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    rating: 5
  },
  {
    quote: "Kippy נותנת לי שקט נפשי שאני לא יכולה למדוד בכסף. לדעת שמישהו שומר על הילדים גם כשאני לא יכולה.",
    name: "ענת שמעון",
    location: "באר שבע",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
    rating: 5
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 40,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut" as const
    }
  }
};

const titleVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut" as const
    }
  }
};

export function LandingTestimonials() {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-card/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={titleVariants}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            המלצות
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            מה ההורים <span className="text-primary text-glow">אומרים</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            אלפי משפחות כבר סומכות על Kippy לשמור על הילדים שלהם
          </p>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={containerVariants}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div 
              key={index}
              variants={cardVariants}
              whileHover={{ 
                y: -8,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 h-full flex flex-col hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
                {/* Quote Icon */}
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                  <Quote className="w-5 h-5 text-primary-foreground" />
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-4 pt-2">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-4 h-4 fill-yellow-400 text-yellow-400" 
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-foreground/90 mb-6 leading-relaxed flex-grow text-right">
                  "{testimonial.quote}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                    <AvatarImage 
                      src={testimonial.avatar} 
                      alt={testimonial.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {testimonial.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right flex-1">
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

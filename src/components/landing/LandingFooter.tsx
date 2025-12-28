import { Link } from 'react-router-dom';
import { Shield, Mail } from 'lucide-react';
import kippyLogo from '@/assets/kippy-logo.png';

export function LandingFooter() {
  return (
    <footer className="py-16 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
              <span className="text-xl font-bold text-primary text-glow">Kippy</span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-md">
              הגנה חכמה לילדים ברשת - בלי לפגוע בפרטיות שלהם. 
              אנחנו כאן כדי לעזור לכם לשמור על הילדים בטוחים.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">קישורים מהירים</h4>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
                  יתרונות
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
                  איך זה עובד
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  תמחור
                </a>
              </li>
              <li>
                <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">
                  שאלות נפוצות
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">צור קשר</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <a href="mailto:support@kippy.ai" className="hover:text-primary transition-colors">
                  support@kippy.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Kippy. כל הזכויות שמורות.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">מדיניות פרטיות</a>
            <a href="#" className="hover:text-primary transition-colors">תנאי שימוש</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

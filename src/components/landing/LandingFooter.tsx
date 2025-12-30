import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';
import kippyLogo from '@/assets/kippy-logo.svg';

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
                <a href="mailto:support@kippyai.com" className="hover:text-primary transition-colors">
                  support@kippyai.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                <a href="https://wa.me/972548383340" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  054-838-3340
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
            <Link to="/privacy" className="hover:text-primary transition-colors">מדיניות פרטיות</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">תנאי שימוש</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

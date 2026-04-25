import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';
import kippyLogo from '@/assets/kippy-logo.svg';

export function FooterV1Expanded() {
  return (
    <footer className="bg-card border-t border-border py-10 md:py-14" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-10">
          {/* Logo & Description */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">Kippy</span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
              הגנה חכמה לילדים ברשת — בלי לפגוע בפרטיות שלהם.
              אנחנו כאן כדי לעזור לכם לשמור על הילדים בטוחים.
            </p>
          </div>

          {/* Quick Links */}
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
                <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  מדיניות פרטיות
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  תנאי שימוש
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">צור קשר</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4 shrink-0" />
                <a href="mailto:support@kippyai.com" className="hover:text-primary transition-colors">
                  support@kippyai.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="w-4 h-4 shrink-0" />
                <a
                  href="https://wa.me/972548383340"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                  dir="ltr"
                >
                  054-838-3340
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} KippyAI · כל הזכויות שמורות
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

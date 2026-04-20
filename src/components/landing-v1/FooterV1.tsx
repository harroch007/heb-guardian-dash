import { Link } from 'react-router-dom';
import kippyLogo from '@/assets/kippy-logo.svg';

export function FooterV1() {
  return (
    <footer className="bg-white border-t border-border py-10" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
            <span className="text-lg font-bold text-foreground">Kippy</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              מדיניות פרטיות
            </Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              תנאי שימוש
            </Link>
            <a href="mailto:support@kippyai.com" className="text-muted-foreground hover:text-foreground transition-colors">
              support@kippyai.com
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} KippyAI · כל הזכויות שמורות
        </div>
      </div>
    </footer>
  );
}

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';
import { Sparkles } from 'lucide-react';

export function NavbarV1() {
  const { openModal } = useWaitlist();

  const handleCTA = () => {
    if (WAITLIST_MODE) openModal();
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-lg border-b border-border" dir="rtl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/landing-v1" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">KippyAI</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">פיצ'רים</a>
          <a href="#how-it-works" className="hover:text-primary transition-colors">איך זה עובד</a>
          <a href="#faq" className="hover:text-primary transition-colors">שאלות נפוצות</a>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-3">התחברות</Button>
          </Link>
          {WAITLIST_MODE ? (
            <Button size="sm" onClick={handleCTA} className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary text-xs sm:text-sm px-2.5 sm:px-3">
              הצטרפו<span className="hidden sm:inline"> לרשימת ההמתנה</span>
            </Button>
          ) : (
            <Link to="/auth?signup=true">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-2.5 sm:px-3">
                הצטרפו<span className="hidden sm:inline"> חינם</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

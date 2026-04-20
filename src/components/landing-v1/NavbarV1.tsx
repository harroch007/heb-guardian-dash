import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';
import kippyLogo from '@/assets/kippy-logo.svg';

export function NavbarV1() {
  const { openModal } = useWaitlist();

  const handleCTA = () => {
    if (WAITLIST_MODE) openModal();
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur border-b border-border" dir="rtl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/landing-v1" className="flex items-center gap-2">
          <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
          <span className="text-xl font-bold text-foreground">Kippy</span>
        </Link>
        <div className="flex items-center gap-2">
          {!WAITLIST_MODE && (
            <Link to="/auth">
              <Button variant="ghost" size="sm">התחברות</Button>
            </Link>
          )}
          {WAITLIST_MODE ? (
            <Button size="sm" onClick={handleCTA} className="bg-primary text-primary-foreground hover:bg-primary/90">
              הצטרפו חינם
            </Button>
          ) : (
            <Link to="/auth?signup=true">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                הצטרפו חינם
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

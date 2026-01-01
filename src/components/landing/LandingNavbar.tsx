import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import kippyLogo from '@/assets/kippy-logo.svg';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openModal } = useWaitlist();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const handleCTAClick = () => {
    if (WAITLIST_MODE) {
      openModal();
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
            <span className="text-xl font-bold text-primary text-glow">Kippy</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => scrollToSection('features')} 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              יתרונות
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')} 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              איך זה עובד
            </button>
            <button 
              onClick={() => scrollToSection('pricing')} 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              תמחור
            </button>
            <button 
              onClick={() => scrollToSection('faq')} 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              שאלות נפוצות
            </button>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {/* התחברות always goes to /auth for existing users */}
            <Link to="/auth">
              <Button variant="ghost">התחברות</Button>
            </Link>
            {/* התחילו חינם goes to waitlist in WAITLIST_MODE, otherwise signup */}
            {WAITLIST_MODE ? (
              <Button className="glow-primary" onClick={handleCTAClick}>התחילו חינם</Button>
            ) : (
              <Link to="/auth?signup=true">
                <Button className="glow-primary">התחילו חינם</Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-muted-foreground hover:text-foreground transition-colors text-right"
              >
                יתרונות
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className="text-muted-foreground hover:text-foreground transition-colors text-right"
              >
                איך זה עובד
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="text-muted-foreground hover:text-foreground transition-colors text-right"
              >
                תמחור
              </button>
              <button 
                onClick={() => scrollToSection('faq')} 
                className="text-muted-foreground hover:text-foreground transition-colors text-right"
              >
                שאלות נפוצות
              </button>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                {/* התחברות always goes to /auth for existing users */}
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">התחברות</Button>
                </Link>
                {/* התחילו חינם goes to waitlist in WAITLIST_MODE, otherwise signup */}
                {WAITLIST_MODE ? (
                  <Button className="w-full glow-primary" onClick={handleCTAClick}>התחילו חינם</Button>
                ) : (
                  <Link to="/auth?signup=true" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full glow-primary">התחילו חינם</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

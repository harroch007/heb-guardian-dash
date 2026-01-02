import React, { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CookieConsent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show after a short delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('cookie-consent', 'all');
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem('cookie-consent', 'essential');
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div ref={ref} className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-xl p-5">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 left-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="סגור"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Cookie icon and title */}
        <div className="flex items-center gap-2 justify-end mb-3">
          <h3 className="font-semibold text-foreground">הסכמה לשימוש בעוגיות</h3>
          <Cookie className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground text-right mb-4 leading-relaxed">
          אנו משתמשים בעוגיות כדי לשפר את החוויה שלך באתר. עוגיות חיוניות נדרשות לפעילות האתר, בעוד עוגיות אחרות עוזרות לנו להבין כיצד משתמשים באתר ולשפר אותו.
        </p>

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleEssentialOnly}
            className="text-sm"
          >
            עוגיות חיוניות בלבד
          </Button>
          <Button
            onClick={handleAcceptAll}
            className="text-sm bg-primary hover:bg-primary/90"
          >
            קבל הכל
          </Button>
        </div>

        {/* Manage preferences link */}
        <div className="mt-3 text-center">
          <button
            onClick={handleEssentialOnly}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <span>⚙️</span>
            <span>נהל העדפות</span>
          </button>
        </div>
      </div>
    </div>
  );
});

CookieConsent.displayName = 'CookieConsent';

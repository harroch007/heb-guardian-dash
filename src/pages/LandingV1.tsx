import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWaitlist } from '@/contexts/WaitlistContext';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { CookieConsent } from '@/components/landing/CookieConsent';
import fullMockup from '@/assets/landing-v1/full-landing-mockup.png';

/**
 * LandingV1 — pixel-perfect landing built as a single image embed of the
 * designer's full mockup. A transparent hotspot layer wires the buttons
 * shown in the image to real app logic (Waitlist modal, Auth, etc.).
 *
 * Hotspot coordinates are expressed as percentages of the image container
 * so they stay aligned at every viewport width.
 */
export default function LandingV1() {
  const { user, loading } = useAuth();
  const { openModal } = useWaitlist();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/home-v2', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || user) return null;

  const handleJoinWaitlist = () => {
    if (WAITLIST_MODE) {
      openModal();
    } else {
      navigate('/auth?signup=true');
    }
  };

  // Smooth-scroll to a vertical offset (percentage of the image height)
  const scrollToPercent = (percent: number) => {
    const target = document.documentElement.scrollHeight * (percent / 100);
    window.scrollTo({ top: target, behavior: 'smooth' });
  };

  // Reusable transparent hotspot button.
  const Hotspot = ({
    style,
    label,
    onClick,
  }: {
    style: React.CSSProperties;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute cursor-pointer bg-transparent rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={style}
    />
  );

  return (
    <div className="min-h-screen bg-[#0A0E1A]" dir="rtl">
      {/* Hidden but crawlable text for SEO + screen readers */}
      <h1 className="sr-only">
        KippyAI — פחות מלחמות על זמן מסך, יותר אחריות בבית
      </h1>
      <p className="sr-only">
        KippyAI היא בקרת ההורים המתקדמת ביותר, עם דרך חכמה ללמד ילדים לנהל זמן
        מסך, להרוויח דקות, ולכבד גבולות.
      </p>

      <main id="main-content" className="relative mx-auto max-w-[640px]">
        {/* Full designer mockup — the entire page */}
        <img
          src={fullMockup}
          alt="KippyAI — דף נחיתה: פחות מלחמות על זמן מסך, יותר אחריות בבית"
          loading="eager"
          draggable={false}
          className="w-full h-auto block select-none"
        />

        {/* Transparent hotspot layer (percent-based, viewport-independent) */}
        <div className="absolute inset-0">
          {/* Navbar — turquoise "הצטרפו לרשימת ההמתנה" pill (top-left) */}
          <Hotspot
            label="הצטרפו לרשימת ההמתנה"
            onClick={handleJoinWaitlist}
            style={{ top: '0.45%', left: '1.5%', width: '23%', height: '1.6%' }}
          />

          {/* Navbar internal anchors — soft scroll within the image */}
          <Hotspot
            label="איך זה עובד"
            onClick={() => scrollToPercent(45)}
            style={{ top: '0.7%', left: '40%', width: '8%', height: '1.2%' }}
          />
          <Hotspot
            label="פיצ'רים"
            onClick={() => scrollToPercent(33)}
            style={{ top: '0.7%', left: '49%', width: '7%', height: '1.2%' }}
          />
          <Hotspot
            label="למה קיפי"
            onClick={() => scrollToPercent(75)}
            style={{ top: '0.7%', left: '57%', width: '7%', height: '1.2%' }}
          />
          <Hotspot
            label="שאלות נפוצות"
            onClick={() => scrollToPercent(85)}
            style={{ top: '0.7%', left: '65%', width: '9%', height: '1.2%' }}
          />

          {/* Hero — primary CTA "הצטרפו לרשימת ההמתנה" */}
          <Hotspot
            label="הצטרפו לרשימת ההמתנה"
            onClick={handleJoinWaitlist}
            style={{ top: '15.3%', right: '8%', width: '36%', height: '2.3%' }}
          />

          {/* Hero — secondary "ראו איך זה עובד" */}
          <Hotspot
            label="ראו איך זה עובד"
            onClick={() => scrollToPercent(58)}
            style={{ top: '18.2%', right: '8%', width: '36%', height: '2.3%' }}
          />

          {/* Bottom CTA — "הצטרפו לרשימת ההמתנה" inside the dark night card */}
          <Hotspot
            label="הצטרפו לרשימת ההמתנה"
            onClick={handleJoinWaitlist}
            style={{ bottom: '1.2%', left: '12%', width: '36%', height: '1.8%' }}
          />
        </div>

        {/* Tiny invisible login link fallback (for returning parents) */}
        <Link
          to="/auth"
          className="absolute top-2 right-2 text-[10px] text-white/40 hover:text-white/80 underline-offset-2 hover:underline"
          aria-label="התחברות"
        >
          התחברות
        </Link>
      </main>

      <CookieConsent />
    </div>
  );
}

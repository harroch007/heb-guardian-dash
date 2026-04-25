import { motion } from 'framer-motion';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';
import { useNavigate } from 'react-router-dom';
import heroFull from '@/assets/landing-v1/hero-full-mockup.png';

export function HeroV1() {
  const { openModal } = useWaitlist();
  const navigate = useNavigate();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePrimaryCTA = () => {
    if (WAITLIST_MODE) {
      openModal();
    } else {
      navigate('/auth?signup=true');
    }
  };

  return (
    <section className="relative bg-[#0A0E1A] overflow-hidden" dir="rtl">
      <div className="container mx-auto px-4 py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-6xl mx-auto"
        >
          <img
            src={heroFull}
            alt="KippyAI – פחות מלחמות על זמן מסך, יותר אחריות בבית"
            loading="eager"
            className="w-full h-auto block select-none"
            draggable={false}
          />

          {/* Hotspots — clickable areas overlayed on the image buttons.
              Coordinates are percentage-based to stay aligned across viewports. */}
          <div className="absolute inset-0">
            {/* Primary CTA: "הצטרפו לרשימת ההמתנה" (image-174 — center-bottom area on right side / large turquoise button) */}
            <button
              type="button"
              onClick={handlePrimaryCTA}
              aria-label="הצטרפו לרשימת ההמתנה"
              className="absolute cursor-pointer bg-transparent rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ top: '76%', left: '17%', width: '28%', height: '8.5%' }}
            />
            {/* Secondary CTA: "ראו איך זה עובד" (small button on the far left) */}
            <button
              type="button"
              onClick={() => scrollTo('how-it-works')}
              aria-label="ראו איך זה עובד"
              className="absolute cursor-pointer bg-transparent rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ top: '76%', left: '0%', width: '16%', height: '8.5%' }}
            />
            {/* Secondary CTA inside the embedded mockup card (right side) — also "הצטרפו" */}
            <button
              type="button"
              onClick={handlePrimaryCTA}
              aria-label="הצטרפו לרשימת ההמתנה"
              className="absolute cursor-pointer bg-transparent rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hidden md:block"
              style={{ top: '54%', left: '67%', width: '20%', height: '7%' }}
            />
            {/* "ראו איך זה עובד" inside the embedded mockup card */}
            <button
              type="button"
              onClick={() => scrollTo('how-it-works')}
              aria-label="ראו איך זה עובד"
              className="absolute cursor-pointer bg-transparent rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hidden md:block"
              style={{ top: '63%', left: '67%', width: '20%', height: '6.5%' }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

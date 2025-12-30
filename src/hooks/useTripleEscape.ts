import { useEffect, useRef, useCallback } from 'react';

interface UseTripleEscapeOptions {
  enabled?: boolean;
  onTripleEscape: () => void;
  timeWindow?: number;
}

export function useTripleEscape({
  enabled = true,
  onTripleEscape,
  timeWindow = 1500,
}: UseTripleEscapeOptions): void {
  const escapeCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetCount = useCallback(() => {
    escapeCountRef.current = 0;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetCount();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      escapeCountRef.current += 1;

      // Clear previous timeout and set a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (escapeCountRef.current >= 3) {
        onTripleEscape();
        resetCount();
      } else {
        timeoutRef.current = setTimeout(resetCount, timeWindow);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      resetCount();
    };
  }, [enabled, onTripleEscape, timeWindow, resetCount]);
}

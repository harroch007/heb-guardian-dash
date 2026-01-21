import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to detect and manage service worker updates.
 * Shows a prompt when a new service worker is waiting.
 */
export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showReloadPrompt, setShowReloadPrompt] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // New service worker took control, reload for fresh experience
      window.location.reload();
    };

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowReloadPrompt(true);
      }
    };

    // Check for waiting worker on current registration
    navigator.serviceWorker.ready.then((registration) => {
      // Check if there's already a waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowReloadPrompt(true);
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              setWaitingWorker(newWorker);
              setShowReloadPrompt(true);
            }
          });
        }
      });
    });

    // Listen for controller change (new SW taking over)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (waitingWorker) {
      // Tell the waiting service worker to skip waiting and activate
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setShowReloadPrompt(false);
    }
  }, [waitingWorker]);

  const dismissPrompt = useCallback(() => {
    setShowReloadPrompt(false);
  }, []);

  return {
    showReloadPrompt,
    updateServiceWorker,
    dismissPrompt,
  };
}

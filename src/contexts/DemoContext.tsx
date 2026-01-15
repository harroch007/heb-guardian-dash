import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
  exitDemoMode: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_MODE_KEY = 'kippy_demo_mode';

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    // Check session storage on init
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(DEMO_MODE_KEY) === 'true';
    }
    return false;
  });

  // Persist to session storage
  useEffect(() => {
    if (isDemoMode) {
      sessionStorage.setItem(DEMO_MODE_KEY, 'true');
    } else {
      sessionStorage.removeItem(DEMO_MODE_KEY);
    }
  }, [isDemoMode]);

  const setDemoMode = (value: boolean) => {
    setIsDemoMode(value);
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    sessionStorage.removeItem(DEMO_MODE_KEY);
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, setDemoMode, exitDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within DemoProvider');
  }
  return context;
};

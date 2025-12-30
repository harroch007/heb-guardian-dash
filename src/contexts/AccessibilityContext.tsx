import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AccessibilityConfig {
  textSizeLevel: number;
  highContrast: boolean;
  enhancedFocus: boolean;
  reduceMotion: boolean;
  tripleEscapeEnabled: boolean;
  isHidden: boolean;
}

interface AccessibilityContextType extends AccessibilityConfig {
  isPanelOpen: boolean;
  setTextSizeLevel: (level: number) => void;
  toggleHighContrast: () => void;
  toggleEnhancedFocus: () => void;
  toggleReduceMotion: () => void;
  toggleTripleEscape: () => void;
  hideAccessibility: () => void;
  showAccessibility: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

const STORAGE_KEY = 'accessibility_config';

const defaultConfig: AccessibilityConfig = {
  textSizeLevel: 0,
  highContrast: false,
  enhancedFocus: false,
  reduceMotion: false,
  tripleEscapeEnabled: true,
  isHidden: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

function loadConfig(): AccessibilityConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load accessibility config:', e);
  }
  return defaultConfig;
}

function saveConfig(config: AccessibilityConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save accessibility config:', e);
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AccessibilityConfig>(loadConfig);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Apply accessibility classes to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Text size
    root.classList.remove('accessibility-text-0', 'accessibility-text-1', 'accessibility-text-2', 'accessibility-text-3', 'accessibility-text-4');
    root.classList.add(`accessibility-text-${config.textSizeLevel}`);
    
    // High contrast
    root.classList.toggle('high-contrast', config.highContrast);
    
    // Enhanced focus
    root.classList.toggle('enhanced-focus', config.enhancedFocus);
    
    // Reduce motion
    root.classList.toggle('reduce-motion', config.reduceMotion);
  }, [config]);

  // Save config on change
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const setTextSizeLevel = useCallback((level: number) => {
    setConfig(prev => ({ ...prev, textSizeLevel: Math.max(0, Math.min(4, level)) }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setConfig(prev => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleEnhancedFocus = useCallback(() => {
    setConfig(prev => ({ ...prev, enhancedFocus: !prev.enhancedFocus }));
  }, []);

  const toggleReduceMotion = useCallback(() => {
    setConfig(prev => ({ ...prev, reduceMotion: !prev.reduceMotion }));
  }, []);

  const toggleTripleEscape = useCallback(() => {
    setConfig(prev => ({ ...prev, tripleEscapeEnabled: !prev.tripleEscapeEnabled }));
  }, []);

  const hideAccessibility = useCallback(() => {
    setConfig(prev => ({ ...prev, isHidden: true }));
    setIsPanelOpen(false);
  }, []);

  const showAccessibility = useCallback(() => {
    setConfig(prev => ({ ...prev, isHidden: false }));
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        ...config,
        isPanelOpen,
        setTextSizeLevel,
        toggleHighContrast,
        toggleEnhancedFocus,
        toggleReduceMotion,
        toggleTripleEscape,
        hideAccessibility,
        showAccessibility,
        openPanel,
        closePanel,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

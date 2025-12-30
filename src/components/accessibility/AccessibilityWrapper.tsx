import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useTripleEscape } from '@/hooks/useTripleEscape';
import { AccessibilityButton } from './AccessibilityButton';
import { AccessibilityPanel } from './AccessibilityPanel';
import { RestoreAccessibilityButton } from './RestoreAccessibilityButton';

export function AccessibilityWrapper() {
  const { tripleEscapeEnabled, openPanel, isPanelOpen } = useAccessibility();

  useTripleEscape({
    enabled: tripleEscapeEnabled && !isPanelOpen,
    onTripleEscape: openPanel,
  });

  return (
    <>
      <AccessibilityButton />
      <AccessibilityPanel />
      <RestoreAccessibilityButton />
    </>
  );
}

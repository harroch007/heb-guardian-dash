import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

export function ServiceWorkerUpdatePrompt() {
  const { showReloadPrompt, updateServiceWorker, dismissPrompt } = useServiceWorkerUpdate();

  if (!showReloadPrompt) return null;

  return (
    <div 
      dir="rtl"
      className="fixed bottom-20 md:bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-sm z-50 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">גרסה חדשה זמינה</h4>
          <p className="text-sm opacity-90 mt-1">
            רענן את האפליקציה כדי לקבל את העדכון האחרון
          </p>
          <div className="flex gap-2 mt-3">
            <Button 
              size="sm" 
              variant="secondary"
              onClick={updateServiceWorker}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              רענון אפליקציה
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={dismissPrompt}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              אחר כך
            </Button>
          </div>
        </div>
        <button 
          onClick={dismissPrompt}
          className="text-primary-foreground/60 hover:text-primary-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import { useDemo } from "@/contexts/DemoContext";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

export const DemoBanner = () => {
  const { exitDemoMode } = useDemo();
  const navigate = useNavigate();

  const handleExit = () => {
    exitDemoMode();
    navigate('/');
  };

  return (
    <div className="bg-warning/20 border-b border-warning/30 text-warning-foreground text-center py-2 text-sm font-medium flex items-center justify-center gap-2 relative">
      <span>🎭 מצב הדגמה - הנתונים אינם אמיתיים</span>
      <button
        onClick={handleExit}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-warning/30 transition-colors"
        title="יציאה ממצב הדגמה"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

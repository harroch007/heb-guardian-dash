import { Heart } from "lucide-react";

export const EmptyAlertsState = () => {
  return (
    <div className="py-12 text-center animate-fade-in">
      <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Heart className="w-8 h-8 text-success" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        הכל רגוע
      </h2>
      <p className="text-muted-foreground">
        אין התראות פתוחות — כשמשהו ידרוש תשומת לב, תראה את זה כאן
      </p>
    </div>
  );
};

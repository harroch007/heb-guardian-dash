import { Heart, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmptyAlertsStateProps {
  hasPremium?: boolean;
}

export const EmptyAlertsState = ({ hasPremium = true }: EmptyAlertsStateProps) => {
  const navigate = useNavigate();

  if (!hasPremium) {
    return (
      <div className="py-12 text-center animate-fade-in">
        <div className="w-16 h-16 bg-warning/15 rounded-full flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          קיפי עדיין לא מנטרת
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
          שדרגו לפרימיום כדי שקיפי תנטר את ההודעות של ילדכם ותשלח לכם התראות חכמות על תכנים מסוכנים
        </p>
        <button
          onClick={() => navigate("/checkout")}
          className="px-6 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors"
        >
          שדרוג לפרימיום
        </button>
      </div>
    );
  }

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

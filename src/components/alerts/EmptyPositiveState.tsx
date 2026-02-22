import { Star } from "lucide-react";

export const EmptyPositiveState = () => {
  return (
    <div className="py-12 text-center animate-fade-in">
      <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Star className="w-8 h-8 text-success" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        עוד לא זיהינו רגעים חיוביים
      </h2>
      <p className="text-muted-foreground">
        כשנזהה התנהגות חיובית של הילד — אמפתיה, עזרה, בגרות — היא תופיע כאן
      </p>
    </div>
  );
};

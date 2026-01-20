import { Bookmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptySavedState() {
  return (
    <Card className="bg-card/50 border-border/30">
      <CardContent className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
          <Bookmark className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          אין התראות שמורות
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          לחץ על סימן הסימניה בהתראה כדי לשמור אותה לעיון מאוחר יותר.
        </p>
      </CardContent>
    </Card>
  );
}

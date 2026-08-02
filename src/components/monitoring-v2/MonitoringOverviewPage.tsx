import { useState } from "react";
import { Loader2, Plus, RefreshCw, Smartphone } from "lucide-react";
import { AddChildModal } from "@/components/AddChildModal";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useV2GuardianMonitoring } from "@/hooks/useV2GuardianMonitoring";
import { MonitoringChildCard } from "./MonitoringChildCard";
import { MonitoringSummaryCard } from "./MonitoringSummaryCard";

interface Props {
  mode: "home" | "family";
}

export function MonitoringOverviewPage({ mode }: Props) {
  const { children, loading, error, refresh } = useV2GuardianMonitoring();
  const [addChildOpen, setAddChildOpen] = useState(false);

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">
              Kippy · הגנה חכמה ובקרת הורים
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              {mode === "home" ? "מרכז ההגנה" : "המשפחה שלי"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "home"
                ? "כל שכבות ההגנה, בקרות המכשיר וההתראות במקום אחד."
                : "כל ילד ומכשיר מוצגים בנפרד, עם מעבר למרכז ההגנה המלא."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-11 shrink-0"
            onClick={() => setAddChildOpen(true)}
          >
            <Plus className="ml-1 h-4 w-4" />
            הוספת ילד
          </Button>
        </div>

        {loading ? (
          <div
            className="flex min-h-64 items-center justify-center"
            role="status"
            aria-label="טוען את מצב הניטור"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="space-y-4 py-8 text-center">
              <p className="font-semibold text-foreground">
                לא הצלחנו לטעון את מצב הניטור
              </p>
              <p className="text-sm text-muted-foreground">
                החיבור לא השתנה. אפשר לנסות שוב בעוד רגע.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => void refresh()}
              >
                <RefreshCw className="ml-2 h-4 w-4" />
                ניסיון נוסף
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {mode === "home" && <MonitoringSummaryCard children={children} />}

            {children.length === 0 ? (
              <Card className="border-dashed border-border bg-card">
                <CardContent className="py-12 text-center">
                  <Smartphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                  <h2 className="font-semibold text-foreground">
                    מתחילים בחיבור מכשיר הילד
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    הוסיפו ילד, סרקו את קוד ה־QR במכשיר שלו והשלימו את הרשאות
                    ההגנה והבקרה.
                  </p>
                  <Button
                    type="button"
                    className="mt-5 h-11"
                    onClick={() => setAddChildOpen(true)}
                  >
                    <Plus className="ml-2 h-4 w-4" />
                    הוספת ילד ראשון
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <section className="space-y-3" aria-labelledby="children-heading">
                <h2
                  id="children-heading"
                  className="text-sm font-semibold text-foreground/80"
                >
                  {mode === "home" ? "הילדים ומרכזי ההגנה" : "ילדים ומכשירים"}
                </h2>
                {children.map((child) => (
                  <MonitoringChildCard key={child.id} child={child} />
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <AddChildModal
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onChildAdded={() => void refresh()}
      />
      <BottomNavigationV2 />
    </div>
  );
}

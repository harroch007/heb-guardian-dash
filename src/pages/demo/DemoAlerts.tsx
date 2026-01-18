import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertListView, AlertDetailView, EmptyAlertsState } from "@/components/alerts";
import { toast } from "@/hooks/use-toast";
import { DEMO_ALERTS_FULL } from "@/data/demoData";

const DemoAlerts = () => {
  const [alerts, setAlerts] = useState(DEMO_ALERTS_FULL);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  const handleAcknowledge = (id: number) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
    setSelectedAlertId(null);
    toast({
      title: "תודה",
      description: "ההתראה נשמרה",
    });
  };

  const selectedAlert = selectedAlertId 
    ? alerts.find(a => a.id === selectedAlertId) 
    : null;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            התראות
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {alerts.length > 0 
              ? `${alerts.length} התראות שדורשות תשומת לב`
              : 'מה דורש תשומת לב — ומה כבר טופל'
            }
          </p>
        </div>

        {/* Content */}
        {selectedAlert ? (
          <AlertDetailView
            alert={selectedAlert}
            onAcknowledge={handleAcknowledge}
            onBack={() => setSelectedAlertId(null)}
            showBackButton={alerts.length > 1}
          />
        ) : alerts.length > 0 ? (
          <AlertListView
            alerts={alerts}
            onSelect={setSelectedAlertId}
          />
        ) : (
          <EmptyAlertsState />
        )}
      </div>
    </DashboardLayout>
  );
};

export default DemoAlerts;

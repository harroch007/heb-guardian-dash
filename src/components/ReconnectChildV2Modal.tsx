import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Smartphone } from "lucide-react";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { useAuth } from "@/contexts/AuthContext";

interface ReconnectChildV2ModalProps {
  childId: string | null;
  childName: string;
  onClose: () => void;
}

export function ReconnectChildV2Modal({
  childId,
  childName,
  onClose,
}: ReconnectChildV2ModalProps) {
  const { user } = useAuth();

  return (
    <Dialog open={Boolean(childId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            חיבור מכשיר — {childName}
          </DialogTitle>
        </DialogHeader>

        {childId && user?.id && user.email ? (
          <QRCodeDisplay
            childId={childId}
            parentId={user.id}
            parentEmail={user.email}
            onFinish={onClose}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            לא ניתן ליצור קישור התקנה ללא חשבון הורה פעיל.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

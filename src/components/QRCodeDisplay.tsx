import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Smartphone, Loader2 } from 'lucide-react';

interface QRCodeDisplayProps {
  childId: string;
  parentId: string;
  onFinish: () => void;
}

export function QRCodeDisplay({ childId, parentId, onFinish }: QRCodeDisplayProps) {
  // Generate pairing QR code content as JSON
  const qrContent = JSON.stringify({
    action: 'pair',
    child_id: childId,
    parent_id: parentId,
  });

  return (
    <div className="text-center py-4">
      {/* Loading indicator */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-primary">ממתין לחיבור מכשיר...</span>
      </div>

      <p className="text-muted-foreground mb-6">
        סרוק את הקוד עם אפליקציית Kippy במכשיר של הילד
      </p>

      {/* QR Code */}
      <div className="bg-background p-6 rounded-2xl border border-primary/30 inline-block mb-6 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl pointer-events-none" />
        <QRCodeSVG
          value={qrContent}
          size={200}
          level="H"
          includeMargin
          bgColor="hsl(222, 47%, 6%)"
          fgColor="hsl(180, 100%, 50%)"
        />
      </div>

      {/* Instructions */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Smartphone className="w-5 h-5" />
          <p className="text-sm">
            וודא שהאפליקציה מותקנת במכשיר הילד
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70">
          המודל ייסגר אוטומטית כאשר המכשיר יחובר
        </p>
      </div>

      <Button
        onClick={onFinish}
        variant="outline"
        className="w-full"
        size="lg"
      >
        סגור וחבר מאוחר יותר
      </Button>
    </div>
  );
}

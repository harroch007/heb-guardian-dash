import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Smartphone } from 'lucide-react';

interface QRCodeDisplayProps {
  onFinish: () => void;
}

export function QRCodeDisplay({ onFinish }: QRCodeDisplayProps) {
  const downloadUrl = 'https://kippy.app/download';

  return (
    <div className="text-center py-4">
      {/* Success Icon */}
      <div className="inline-flex items-center justify-center p-4 rounded-full bg-success/20 mb-4">
        <CheckCircle2 className="w-12 h-12 text-success" />
      </div>

      <p className="text-muted-foreground mb-6">
        כעת יש להתקין את האפליקציה על המכשיר של הילד
      </p>

      {/* QR Code */}
      <div className="bg-background p-6 rounded-2xl border border-primary/30 inline-block mb-6">
        <QRCodeSVG
          value={downloadUrl}
          size={200}
          level="H"
          includeMargin
          bgColor="hsl(222, 47%, 6%)"
          fgColor="hsl(180, 100%, 50%)"
        />
      </div>

      {/* Instructions */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
        <Smartphone className="w-5 h-5" />
        <p className="text-sm">
          סרוק עם המכשיר של הילד להורדת האפליקציה
        </p>
      </div>

      <Button
        onClick={onFinish}
        className="w-full glow-primary"
        size="lg"
      >
        סיום
      </Button>
    </div>
  );
}

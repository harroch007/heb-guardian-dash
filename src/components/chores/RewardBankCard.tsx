import { Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RewardBankCardProps {
  balanceMinutes: number;
}

export function RewardBankCard({ balanceMinutes }: RewardBankCardProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
      <CardContent className="p-4 flex items-center gap-4" dir="rtl">
        <div className="p-3 rounded-full bg-primary/20">
          <Coins className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">בנק דקות</p>
          <p className="text-2xl font-bold text-foreground">
            {balanceMinutes} <span className="text-sm font-normal text-muted-foreground">דק׳</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

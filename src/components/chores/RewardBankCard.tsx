import { Coins, CheckCircle, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { RewardTransaction } from "@/hooks/useChores";

interface RewardBankCardProps {
  balanceMinutes: number;
  transactions: RewardTransaction[];
}

const sourceConfig: Record<string, { label: string; icon: typeof Coins; colorClass: string }> = {
  chore_approved: { label: "אישור משימה", icon: CheckCircle, colorClass: "text-green-600" },
  bank_redeem: { label: "פדיון דקות", icon: ArrowDownCircle, colorClass: "text-orange-500" },
  bonus_refund: { label: "החזר בונוס", icon: ArrowUpCircle, colorClass: "text-blue-500" },
};

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export function RewardBankCard({ balanceMinutes, transactions }: RewardBankCardProps) {
  const recent = transactions.slice(0, 5);

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
      <CardContent className="p-4 space-y-3" dir="rtl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/20">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">בנק דקות</p>
            <p className="text-2xl font-bold text-foreground">
              {balanceMinutes} <span className="text-sm font-normal text-muted-foreground">דק׳</span>
            </p>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="border-t border-border/50 pt-2 space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">פעולות אחרונות</p>
            {recent.map((tx) => {
              const cfg = sourceConfig[tx.source] || { label: tx.source, icon: Coins, colorClass: "text-muted-foreground" };
              const Icon = cfg.icon;
              const isPositive = tx.amount_minutes > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.colorClass}`} />
                    <span className="text-foreground">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isPositive ? "text-green-600 font-medium" : "text-orange-500 font-medium"}>
                      {isPositive ? "+" : ""}{tx.amount_minutes} דק׳
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(tx.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

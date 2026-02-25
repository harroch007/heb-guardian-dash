import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Smartphone, Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

interface UserData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  children: { id: string; name: string; gender: string }[];
  devices: { device_id: string; last_seen: string | null; battery_level: number | null }[];
  device_status: 'online' | 'today' | 'offline' | 'no_device';
  last_activity: string | null;
}

interface AttentionUser extends UserData {
  reason: string;
  reasonIcon: 'device' | 'no_device';
  hoursInactive: number | null;
}

interface AdminAttentionReportProps {
  users: UserData[];
  onSelectUser: (user: UserData) => void;
}

function getAttentionUsers(users: UserData[]): AttentionUser[] {
  const now = Date.now();
  const HOURS_48 = 48 * 60 * 60 * 1000;

  const result: AttentionUser[] = [];

  for (const user of users) {
    // Case 1: Has device but inactive > 48h
    if (user.device_status === 'offline' && user.last_activity) {
      const lastActivityTime = new Date(user.last_activity).getTime();
      const diff = now - lastActivityTime;
      if (diff > HOURS_48) {
        result.push({
          ...user,
          reason: "מכשיר לא פעיל מעל 48 שעות",
          reasonIcon: 'device',
          hoursInactive: Math.floor(diff / (60 * 60 * 1000)),
        });
        continue;
      }
    }

    // Case 2: No device connected at all (registered but never connected)
    if (user.device_status === 'no_device') {
      const registeredTime = new Date(user.created_at).getTime();
      const diff = now - registeredTime;
      // Only flag if registered > 24h ago (give them time to set up)
      if (diff > 24 * 60 * 60 * 1000) {
        result.push({
          ...user,
          reason: "נרשם ללא חיבור מכשיר",
          reasonIcon: 'no_device',
          hoursInactive: null,
        });
      }
    }
  }

  // Sort: longest inactive first
  result.sort((a, b) => {
    if (a.hoursInactive != null && b.hoursInactive != null) return b.hoursInactive - a.hoursInactive;
    if (a.hoursInactive != null) return -1;
    return 1;
  });

  return result;
}

function openWhatsApp(phone: string | null, name: string) {
  if (!phone) return;
  const cleaned = phone.replace(/[^0-9+]/g, "");
  const intl = cleaned.startsWith("0") ? "972" + cleaned.slice(1) : cleaned.replace("+", "");
  const msg = encodeURIComponent(`שלום ${name}, פונים אליך מ-KippyAI. שמנו לב שהמכשיר לא פעיל - רצינו לוודא שהכל בסדר ולהציע עזרה 🙏`);
  window.open(`https://wa.me/${intl}?text=${msg}`, "_blank");
}

export function AdminAttentionReport({ users, onSelectUser }: AdminAttentionReportProps) {
  const attentionUsers = getAttentionUsers(users);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">דורשים טיפול</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-500">{attentionUsers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">מכשיר לא פעיל 48+</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-500">
              {attentionUsers.filter(u => u.reasonIcon === 'device').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-muted-foreground/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">ללא מכשיר (24+ שעות)</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {attentionUsers.filter(u => u.reasonIcon === 'no_device').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            לקוחות שדורשים טיפול
          </CardTitle>
          <CardDescription>{attentionUsers.length} לקוחות</CardDescription>
        </CardHeader>
        <CardContent>
          {attentionUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">🎉 אין לקוחות שדורשים טיפול כרגע</p>
              <p className="text-sm mt-1">כל המכשירים פעילים</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">סיבה</TableHead>
                    <TableHead className="text-right">זמן חוסר פעילות</TableHead>
                    <TableHead className="text-right">ילדים</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attentionUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20">
                      <TableCell>
                        <button
                          className="font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                          onClick={() => onSelectUser(user)}
                        >
                          {user.full_name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={user.reasonIcon === 'device'
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          }
                        >
                          {user.reasonIcon === 'device' ? '🔴' : '⚪'} {user.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.last_activity
                          ? formatDistanceToNow(new Date(user.last_activity), { addSuffix: true, locale: he })
                          : user.reasonIcon === 'no_device'
                            ? `נרשם ${formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: he })}`
                            : "—"
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.children.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            user.children.map(c => (
                              <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs gap-1 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                            disabled={!user.phone}
                            onClick={() => openWhatsApp(user.phone, user.full_name)}
                            title={user.phone ? "שלח WhatsApp" : "אין מספר טלפון"}
                          >
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

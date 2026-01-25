import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Smartphone, Baby, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

interface UserData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  children: {
    id: string;
    name: string;
    gender: string;
  }[];
  devices: {
    device_id: string;
    last_seen: string | null;
    battery_level: number | null;
  }[];
  device_status: 'online' | 'today' | 'offline' | 'no_device';
  last_activity: string | null;
}

interface AdminUsersProps {
  users: UserData[];
  loading: boolean;
}

export function AdminUsers({ users, loading }: AdminUsersProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.includes(search);
    
    const matchesStatus = 
      statusFilter === "all" || 
      user.device_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">🟢 אונליין</Badge>;
      case 'today':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">🟡 פעיל היום</Badge>;
      case 'offline':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔴 לא פעיל</Badge>;
      case 'no_device':
        return <Badge variant="outline" className="text-muted-foreground">⚪ ללא מכשיר</Badge>;
      default:
        return <Badge variant="outline">לא ידוע</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען משתמשים...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">סה"כ הורים</span>
            </div>
            <p className="text-2xl font-bold mt-1">{users.length}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">אונליין עכשיו</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-500">
              {users.filter(u => u.device_status === 'online').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">פעילים היום</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-500">
              {users.filter(u => u.device_status === 'online' || u.device_status === 'today').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Baby className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">ללא מכשיר</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-500">
              {users.filter(u => u.device_status === 'no_device').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            רשימת משתמשים
          </CardTitle>
          <CardDescription>{filteredUsers.length} תוצאות</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם, אימייל או טלפון..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="online">אונליין</SelectItem>
                <SelectItem value="today">פעיל היום</SelectItem>
                <SelectItem value="offline">לא פעיל</SelectItem>
                <SelectItem value="no_device">ללא מכשיר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">שם מלא</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">תאריך הרשמה</TableHead>
                  <TableHead className="text-right">ילדים</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">פעילות אחרונה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      לא נמצאו משתמשים
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{user.phone || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), "dd/MM/yy", { locale: he })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.children.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            user.children.map((child) => (
                              <Badge key={child.id} variant="outline" className="text-xs">
                                {child.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.device_status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.last_activity ? (
                          formatDistanceToNow(new Date(user.last_activity), { 
                            addSuffix: true, 
                            locale: he 
                          })
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

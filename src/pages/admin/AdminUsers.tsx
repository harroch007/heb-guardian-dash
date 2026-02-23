import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Smartphone, Baby, Clock, UserCheck, Loader2, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  initialStatusFilter?: string;
  onFilterApplied?: () => void;
}

export function AdminUsers({ users, loading, initialStatusFilter, onFilterApplied }: AdminUsersProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || "all");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [iframeOpen, setIframeOpen] = useState(false);
  const [iframeUserName, setIframeUserName] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      onFilterApplied?.();
    }
  }, [initialStatusFilter]);

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

  const pendingTokensRef = useRef<{ access_token: string; refresh_token: string } | null>(null);

  const sendTokensToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const tokens = pendingTokensRef.current;
    if (!iframe?.contentWindow || !tokens) return;
    
    iframe.contentWindow.postMessage(
      { type: "impersonate-tokens", ...tokens },
      window.location.origin
    );
    pendingTokensRef.current = null;
  }, []);

  const handleIframeLoad = useCallback(() => {
    // iframe finished loading, send tokens now
    sendTokensToIframe();
  }, [sendTokensToIframe]);

  const handleImpersonate = async (userId: string, userName: string) => {
    setImpersonatingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { userId },
      });

      if (error || !data?.access_token) {
        throw new Error(data?.error || error?.message || "Failed to impersonate");
      }

      // Store tokens and open iframe — tokens sent on iframe load
      pendingTokensRef.current = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
      setIframeUserName(userName);
      setIframeOpen(true);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "שגיאה בהתחזות",
        description: err.message,
      });
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleCloseIframe = () => {
    setIframeOpen(false);
    setIframeUserName("");
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
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs gap-1"
                          disabled={impersonatingId === user.id}
                          onClick={() => handleImpersonate(user.id, user.full_name)}
                        >
                          {impersonatingId === user.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserCheck className="w-3 h-3" />
                          )}
                          היכנס כהורה
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Impersonation iframe dialog */}
      <Dialog open={iframeOpen} onOpenChange={handleCloseIframe}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">מצב התחזות — {iframeUserName}</DialogTitle>
          <div
            dir="rtl"
            className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>מצב התחזות — צופה כ: {iframeUserName}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-black/30 bg-black/10 hover:bg-black/20 text-black"
              onClick={handleCloseIframe}
            >
              <X className="w-3 h-3 ml-1" />
              סגור
            </Button>
          </div>
          <iframe
            ref={iframeRef}
            src="/impersonate-session"
            className="w-full flex-1 border-0"
            style={{ height: "calc(90vh - 40px)" }}
            onLoad={handleIframeLoad}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

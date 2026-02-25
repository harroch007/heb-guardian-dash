import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Tag, AlertTriangle } from "lucide-react";
import { AdminUsers } from "./AdminUsers";
import { AdminWaitlist } from "./AdminWaitlist";
import { AdminPromoCodes } from "./AdminPromoCodes";
import { AdminCustomerProfile } from "./AdminCustomerProfile";
import { AdminAttentionReport } from "./AdminAttentionReport";

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

interface WaitlistEntry {
  id: string;
  parent_name: string;
  email: string;
  phone: string;
  child_age: number;
  device_os: string;
  region: string | null;
  referral_source: string | null;
  status: string | null;
  created_at: string;
}

interface AdminUsersHubProps {
  users: UserData[];
  waitlist: WaitlistEntry[];
  loading: boolean;
  onRefreshWaitlist: () => void;
  funnel?: { stage: string; count: number }[];
  initialStatusFilter?: string;
  onFilterApplied?: () => void;
  initialSubTab?: string;
}

export function AdminUsersHub({ 
  users, waitlist, loading, onRefreshWaitlist, funnel,
  initialStatusFilter, onFilterApplied, initialSubTab
}: AdminUsersHubProps) {
  const [subTab, setSubTab] = useState(initialSubTab || "users");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            משתמשים ({users.length})
          </TabsTrigger>
          <TabsTrigger value="attention" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            דורשים טיפול
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-2">
            <UserPlus className="w-4 h-4" />
            רשימת המתנה ({waitlist.length})
          </TabsTrigger>
          <TabsTrigger value="promo" className="gap-2">
            <Tag className="w-4 h-4" />
            פרומו קודים
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsers 
            users={users} 
            loading={loading} 
            initialStatusFilter={initialStatusFilter}
            onFilterApplied={onFilterApplied}
            onSelectUser={setSelectedUser}
          />
        </TabsContent>

        <TabsContent value="attention">
          <AdminAttentionReport users={users} onSelectUser={setSelectedUser} />
        </TabsContent>

        <TabsContent value="waitlist">
          <AdminWaitlist 
            entries={waitlist} 
            loading={loading} 
            onRefresh={onRefreshWaitlist}
            funnel={funnel}
          />
        </TabsContent>

        <TabsContent value="promo">
          <AdminPromoCodes />
        </TabsContent>
      </Tabs>

      {selectedUser && (
        <AdminCustomerProfile
          user={selectedUser}
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

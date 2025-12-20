import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ChildCard } from '@/components/ChildCard';
import { AddChildModal } from '@/components/AddChildModal';
import { Button } from '@/components/ui/button';
import { Plus, Users, Loader2 } from 'lucide-react';

interface Child {
  id: string;
  name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  city: string | null;
  school: string | null;
  created_at: string;
}

export default function Family() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { user } = useAuth();

  const fetchChildren = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching children:', error);
    } else {
      setChildren(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChildren();
  }, [user]);

  const handleChildAdded = () => {
    fetchChildren();
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground text-glow flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              המשפחה שלי
            </h1>
            <p className="text-muted-foreground mt-1">
              נהל את הילדים והמכשירים המחוברים
            </p>
          </div>
          
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="glow-primary flex items-center gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            הוסף ילד
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center p-6 rounded-2xl bg-muted/50 mb-6">
              <Users className="w-16 h-16 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              עדיין אין ילדים
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              הוסף את הילד הראשון שלך כדי להתחיל לנטר את הפעילות הדיגיטלית שלו
            </p>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="glow-primary"
              size="lg"
            >
              <Plus className="w-5 h-5 ml-2" />
              הוסף ילד
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child, index) => (
              <ChildCard 
                key={child.id} 
                child={child} 
                style={{ animationDelay: `${index * 100}ms` }}
              />
            ))}
          </div>
        )}

        <AddChildModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onChildAdded={handleChildAdded}
        />
      </div>
    </DashboardLayout>
  );
}

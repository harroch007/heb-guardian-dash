import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ChildCard, Child } from '@/components/ChildCard';
import { AddChildModal } from '@/components/AddChildModal';
import { ReconnectChildModal } from '@/components/ReconnectChildModal';
import { EditChildModal } from '@/components/EditChildModal';
import { Button } from '@/components/ui/button';
import { Plus, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Family() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reconnectChild, setReconnectChild] = useState<{ id: string; name: string } | null>(null);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [deleteChild, setDeleteChild] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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

  const handleConnectDevice = (childId: string, childName: string) => {
    setReconnectChild({ id: childId, name: childName });
  };

  const handleEditChild = (child: Child) => {
    setEditChild(child);
  };

  const handleDeleteChild = (childId: string, childName: string) => {
    setDeleteChild({ id: childId, name: childName });
  };

  const confirmDeleteChild = async () => {
    if (!deleteChild) return;

    setIsDeleting(true);
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', deleteChild.id);

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למחוק את הילד',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'הילד נמחק',
        description: `${deleteChild.name} הוסר מהמשפחה`,
      });
      fetchChildren();
    }

    setIsDeleting(false);
    setDeleteChild(null);
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
                onConnectDevice={handleConnectDevice}
                onEditChild={handleEditChild}
                onDeleteChild={handleDeleteChild}
              />
            ))}
          </div>
        )}

        <AddChildModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onChildAdded={handleChildAdded}
        />

        <ReconnectChildModal
          childId={reconnectChild?.id || null}
          childName={reconnectChild?.name || ''}
          parentEmail={user?.email || ''}
          onClose={() => setReconnectChild(null)}
        />

        {/* Edit Child Modal */}
        {editChild && (
          <EditChildModal
            child={editChild}
            open={!!editChild}
            onOpenChange={(open) => !open && setEditChild(null)}
            onUpdated={() => {
              fetchChildren();
              setEditChild(null);
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteChild} onOpenChange={(open) => !open && setDeleteChild(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
              <AlertDialogDescription>
                פעולה זו תמחק את כל הנתונים של {deleteChild?.name} כולל התראות, מכשירים ונתוני שימוש.
                לא ניתן לבטל פעולה זו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteChild}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                מחק
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

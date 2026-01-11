import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Child } from '@/components/ChildCard';
import { AddChildModal } from '@/components/AddChildModal';
import { ReconnectChildModal } from '@/components/ReconnectChildModal';
import { EditChildModal } from '@/components/EditChildModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Users, Loader2, User, ChevronLeft } from 'lucide-react';
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
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reconnectChild, setReconnectChild] = useState<{ id: string; name: string } | null>(null);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [deleteChild, setDeleteChild] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

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
              ניהול הילדים והמכשירים המחוברים
            </p>
          </div>
          
          {/* Header CTA only for State C (multiple children) */}
          {!loading && children.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף ילד/ה
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : children.length === 0 ? (
          /* State A: ZERO children */
          <div className="flex items-center justify-center py-20">
            <Card className="w-full max-w-md text-center p-8 bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-0 space-y-4">
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-muted/50 mb-2">
                  <Users className="w-12 h-12 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  אין ילדים עדיין
                </h2>
                <p className="text-muted-foreground">
                  כדי להתחיל, הוסף ילד/ה ראשון/ה למשפחה
                </p>
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="glow-primary mt-4"
                  size="lg"
                >
                  <Plus className="w-5 h-5 ml-2" />
                  הוסף ילד/ה
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : children.length === 1 ? (
          /* State B: ONE child */
          <Card className="w-full bg-card/80 backdrop-blur-sm border-primary/20">
            <CardContent className="p-6">
              {/* Child Info */}
              <div className="flex items-start gap-4 mb-6">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    <User className="w-8 h-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {children[0].name}
                  </h2>
                  {children[0].date_of_birth && (
                    <p className="text-muted-foreground mt-1">
                      {calculateAge(children[0].date_of_birth)} שנים
                    </p>
                  )}
                  {/* TODO(DATA): Status pill requires device data */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      סטטוס לא ידוע*
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => navigate(`/child/${children[0].id}`)}
                  className="w-full glow-primary"
                  size="lg"
                >
                  ניהול הילד
                  <ChevronLeft className="w-5 h-5 mr-2" />
                </Button>
                <Button
                  variant="ghost"
                  className="text-primary hover:text-primary/80"
                  onClick={() => setReconnectChild({ id: children[0].id, name: children[0].name })}
                >
                  חיבור WhatsApp / QR
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* State C: MULTIPLE children */
          <div className="space-y-3">
            {children.map((child) => (
              <Card 
                key={child.id}
                className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/child/${child.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-muted">
                        <User className="w-6 h-6 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Name + Age */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {child.name}
                      </h3>
                      {child.date_of_birth && (
                        <p className="text-sm text-muted-foreground">
                          {calculateAge(child.date_of_birth)} שנים
                        </p>
                      )}
                    </div>

                    {/* TODO(DATA): Status pill requires device data */}
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      סטטוס*
                    </span>

                    {/* Chevron */}
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Child } from '@/components/ChildCard';
import { AddChildModal } from '@/components/AddChildModal';
import { ReconnectChildModal } from '@/components/ReconnectChildModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, User, ChevronLeft, QrCode } from 'lucide-react';

export default function Family() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reconnectChild, setReconnectChild] = useState<{ id: string; name: string } | null>(null);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            המשפחה שלי
          </h1>
          <p className="text-muted-foreground mt-1">
            ילדים, חיבור מכשיר, וניהול הרשאות
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Section A: הילדים שלי */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">הילדים שלי</h2>
              
              {loading ? (
                <p className="text-muted-foreground text-sm">טוען...</p>
              ) : children.length === 0 ? (
                <>
                  {/* TODO(DATA): Empty state when no children */}
                  <p className="text-muted-foreground text-sm">
                    אין ילדים מחוברים עדיין*
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  {children.map((child) => (
                    <div 
                      key={child.id}
                      onClick={() => navigate(`/child/${child.id}`)}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      {/* Avatar */}
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-muted">
                          <User className="w-5 h-5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Name */}
                      <span className="flex-1 font-medium text-foreground">
                        {child.name}
                      </span>
                      
                      {/* TODO(DATA): No real connection status available */}
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        לא מחובר*
                      </span>
                      
                      {/* Chevron */}
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B: חיבור וואטסאפ */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">חיבור וואטסאפ</h2>
              <p className="text-sm text-muted-foreground mb-4">
                התחברו למכשיר של הילד באמצעות QR
              </p>
              
              <Button 
                onClick={() => {
                  if (children.length > 0) {
                    setReconnectChild({ id: children[0].id, name: children[0].name });
                  }
                }}
                disabled={children.length === 0}
                className="w-full"
              >
                <QrCode className="w-4 h-4 ml-2" />
                סריקת QR
              </Button>
              
              {/* TODO(DATA): QR process explanation */}
              <p className="text-xs text-muted-foreground mt-3 text-center">
                תהליך החיבור יתבצע במכשיר של הילד*
              </p>
            </CardContent>
          </Card>

          {/* Bottom CTA */}
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף ילד/ה
          </Button>
        </div>

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
      </div>
    </DashboardLayout>
  );
}

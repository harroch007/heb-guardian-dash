import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DemoBanner } from '@/components/DemoBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, User, ChevronLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DEMO_CHILDREN } from '@/data/demoData';

export default function DemoFamily() {
  const navigate = useNavigate();

  const handleAddChild = () => {
    toast({
      title: "מצב הדגמה",
      description: "הוספת ילד אינה זמינה במצב הדגמה",
    });
  };

  return (
    <DashboardLayout>
      <DemoBanner />
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
              
              <div className="space-y-3">
                {DEMO_CHILDREN.map((child) => (
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
                    
                    {/* Connection Status */}
                    <span className="text-xs px-2 py-1 rounded-full bg-success/20 text-success">
                      מחובר
                    </span>
                    
                    {/* Chevron */}
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bottom CTA */}
          <Button 
            onClick={handleAddChild}
            className="w-full"
            size="lg"
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף ילד/ה
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

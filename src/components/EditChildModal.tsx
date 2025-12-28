import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Child {
  id: string;
  name: string;
  date_of_birth: string;
  gender: string;
}

interface EditChildModalProps {
  child: Child;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updatedChild: Child) => void;
}

export function EditChildModal({ child, open, onOpenChange, onUpdated }: EditChildModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(child.name);
  const [dateOfBirth, setDateOfBirth] = useState(child.date_of_birth);
  const [gender, setGender] = useState(child.gender);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם',
        variant: 'destructive',
      });
      return;
    }

    if (!dateOfBirth) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין תאריך לידה',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('children')
      .update({
        name: name.trim(),
        date_of_birth: dateOfBirth,
        gender,
      })
      .eq('id', child.id);

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את פרטי הילד',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    toast({
      title: 'הפרטים עודכנו',
      description: 'פרטי הילד עודכנו בהצלחה',
    });

    onUpdated({
      ...child,
      name: name.trim(),
      date_of_birth: dateOfBirth,
      gender,
    });
    
    onOpenChange(false);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת פרטי ילד</DialogTitle>
          <DialogDescription>
            עדכן את הפרטים של {child.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">שם</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם הילד/ה"
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">תאריך לידה</Label>
            <Input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">מגדר</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="בחר מגדר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">בן</SelectItem>
                <SelectItem value="female">בת</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

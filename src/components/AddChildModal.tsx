import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { z } from "zod";

interface AddChildModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChildAdded: () => void;
}

const childSchema = z.object({
  name: z.string().min(2, "השם חייב להכיל לפחות 2 תווים").max(100),
  day: z.string().min(1, "נא לבחור יום"),
  month: z.string().min(1, "נא לבחור חודש"),
  year: z.string().min(1, "נא לבחור שנה"),
  gender: z.enum(["male", "female", "other"], { required_error: "נא לבחור מין" }),
});

const hebrewMonths = [
  { value: "1", label: "ינואר" },
  { value: "2", label: "פברואר" },
  { value: "3", label: "מרץ" },
  { value: "4", label: "אפריל" },
  { value: "5", label: "מאי" },
  { value: "6", label: "יוני" },
  { value: "7", label: "יולי" },
  { value: "8", label: "אוגוסט" },
  { value: "9", label: "ספטמבר" },
  { value: "10", label: "אוקטובר" },
  { value: "11", label: "נובמבר" },
  { value: "12", label: "דצמבר" },
];

export function AddChildModal({ open, onOpenChange, onChildAdded }: AddChildModalProps) {
  const [step, setStep] = useState<"form" | "pairing">("form");
  const [name, setName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [childId, setChildId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear; y >= currentYear - 18; y--) {
      arr.push(y.toString());
    }
    return arr;
  }, [currentYear]);

  const days = useMemo(() => {
    const daysInMonth = month && year ? new Date(parseInt(year), parseInt(month), 0).getDate() : 31;
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  }, [month, year]);

  const resetForm = () => {
    setName("");
    setDay("");
    setMonth("");
    setYear("");
    setGender("");
    setErrors({});
    setStep("form");
    setChildId(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateForm = () => {
    try {
      childSchema.parse({
        name,
        day,
        month,
        year,
        gender: gender as "male" | "female" | "other",
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) return;

    const dateOfBirth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("children")
        .insert({
          parent_id: user.id,
          name: name.trim(),
          phone_number: "",
          date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
          gender,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error adding child:", error);
        if (error.code === '23505') {
          toast({
            title: "לא ניתן להוסיף את הילד",
            description: "מספר הטלפון כבר קיים במערכת. אם אתה חושב שמדובר בטעות, פנה לשירות הלקוחות שלנו בכתובת yariv@kippyai.com",
            variant: "destructive",
          });
        } else if (error.code === '42501' || error.message?.includes('row-level security')) {
          toast({
            title: "אין הרשאה",
            description: "אין לך הרשאה להוסיף ילד. נסה להתנתק ולהתחבר מחדש. אם הבעיה נמשכת, פנה ל-support@kippyai.com",
            variant: "destructive",
          });
        } else {
          toast({
            title: "שגיאה",
            description: "לא ניתן להוסיף את הילד. נסה שוב מאוחר יותר.",
            variant: "destructive",
          });
        }
        return;
      }

      setChildId(data.id);
      setStep("pairing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!childId || step !== "pairing") return;

    const channel = supabase
      .channel(`device-pairing-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          console.log("Device paired!", payload);
          toast({
            title: "🎉 המכשיר חובר בהצלחה!",
            description: "המכשיר של הילד מחובר כעת למערכת",
          });
          handleClose();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId, step]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card/95 backdrop-blur-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">{step === "form" ? "הוספת ילד חדש" : "חיבור מכשיר"}</DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">שם הילד *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="שם הילד"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pr-10"
                />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            {/* Date of Birth - Dropdowns */}
            <div className="space-y-2">
              <Label>תאריך לידה *</Label>
              <div className="grid grid-cols-3 gap-2">
                {/* Day */}
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="יום" />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Month */}
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="חודש" />
                  </SelectTrigger>
                  <SelectContent>
                    {hebrewMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Year */}
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="שנה" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(errors.day || errors.month || errors.year) && (
                <p className="text-sm text-destructive">נא למלא את כל שדות התאריך</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>מין *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מין" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">בן</SelectItem>
                  <SelectItem value="female">בת</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender}</p>}
            </div>

            <Button type="submit" className="w-full glow-primary mt-6" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              המשך לחיבור מכשיר
            </Button>
          </form>
        ) : (
          <QRCodeDisplay childId={childId!} parentId={user?.id || ""} parentEmail={user?.email || ""} onFinish={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createGuardianChild } from "@/lib/v2/guardianService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface AddChildModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChildAdded: () => void;
}

// Kept only as a dormant donor path. V2 stores birth year, not an exact date.
const LEGACY_EXACT_BIRTH_DATE_ENABLED = false;

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
  const { user, familyId } = useAuth();
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
    const childWasAdded = childId !== null;
    resetForm();
    onOpenChange(false);
    if (childWasAdded) {
      onChildAdded();
    }
  };

  const validateForm = () => {
    try {
      childSchema.parse({
        name,
        day: LEGACY_EXACT_BIRTH_DATE_ENABLED ? day : "1",
        month: LEGACY_EXACT_BIRTH_DATE_ENABLED ? month : "1",
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

    if (!validateForm() || !user || !familyId) return;

    setLoading(true);

    try {
      const result = await createGuardianChild({
        familyId,
        displayName: name,
        birthYear: parseInt(year),
        gender: gender as "male" | "female" | "other",
      });
      setChildId(result.childId);
      setStep("pairing");
    } catch (error) {
      console.error("Error adding V2 child:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להוסיף את הילד/ה. נסו שוב.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card/95 backdrop-blur-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">{step === "form" ? "הוספת ילד חדש" : "חיבור מכשיר"}</DialogTitle>
          <DialogDescription className="sr-only">
            {step === "form"
              ? "הוסיפו את פרטי הילד כדי ליצור חיבור מאובטח למכשיר שלו."
              : "סרקו את קוד ה־QR ממכשיר הילד כדי להתחיל את תהליך ההתקנה."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">שם הילד/ה *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="שם הילד/ה"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 pr-10"
                />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            {/* V2 collects only what the backend stores: birth year. */}
            {LEGACY_EXACT_BIRTH_DATE_ENABLED ? (
              <div className="space-y-2">
                <Label>תאריך לידה *</Label>
                <div className="grid grid-cols-3 gap-2">
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
            ) : (
              <div className="space-y-2">
                <Label>שנת לידה *</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-11" aria-label="שנת לידה">
                    <SelectValue placeholder="בחרו שנה" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.year && (
                  <p className="text-sm text-destructive">נא לבחור שנת לידה</p>
                )}
                <p className="text-xs text-muted-foreground">
                  השנה משמשת להתאמת ניתוח הסיכון לגיל הילד/ה.
                </p>
              </div>
            )}

            {/* Gender */}
            <div className="space-y-2">
              <Label>מין *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-11" aria-label="מין">
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

            <Button type="submit" className="h-11 w-full glow-primary mt-6" disabled={loading}>
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

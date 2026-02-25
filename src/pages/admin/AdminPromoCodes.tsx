import { useState, useEffect } from "react";
import { adminSupabase } from "@/integrations/supabase/admin-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

function getDiscountLabel(type: string, value: number): string {
  switch (type) {
    case "free_months": return value === 1 ? "חודש חינם" : `${value} חודשים חינם`;
    case "fixed_price": return `₪${value}/חודש לתמיד`;
    case "percent_off": return `${value}% הנחה`;
    default: return type;
  }
}

export function AdminPromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newCode, setNewCode] = useState("");
  const [discountType, setDiscountType] = useState("free_months");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await adminSupabase
      .from("promo_codes" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("שגיאה בטעינת קודים");
    } else {
      setCodes((data as any) || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !discountValue) {
      toast.error("יש למלא קוד וערך הנחה");
      return;
    }

    setCreating(true);
    const { error } = await adminSupabase
      .from("promo_codes" as any)
      .insert({
        code: newCode.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: parseInt(discountValue),
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expiresAt || null,
      } as any);

    if (error) {
      if (error.code === "23505") {
        toast.error("קוד כבר קיים");
      } else {
        toast.error("שגיאה ביצירת קוד: " + error.message);
      }
    } else {
      toast.success("קוד נוצר בהצלחה!");
      setNewCode("");
      setDiscountValue("");
      setMaxUses("");
      setExpiresAt("");
      fetchCodes();
    }
    setCreating(false);
  };

  const handleToggle = async (code: PromoCode) => {
    const { error } = await adminSupabase
      .from("promo_codes" as any)
      .update({ is_active: !code.is_active } as any)
      .eq("id", code.id);

    if (error) {
      toast.error("שגיאה בעדכון");
    } else {
      toast.success(code.is_active ? "קוד הושבת" : "קוד הופעל");
      fetchCodes();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await adminSupabase
      .from("promo_codes" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה במחיקה");
    } else {
      toast.success("קוד נמחק");
      fetchCodes();
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("he-IL");

  return (
    <div className="space-y-6">
      {/* Create Code Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            יצירת קוד חדש
          </CardTitle>
          <CardDescription>צור קוד הנחה עם חוקים גמישים</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>קוד</Label>
              <Input
                placeholder="WELCOME2024"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>סוג הנחה</Label>
              <Select value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_months">חודשים חינם</SelectItem>
                  <SelectItem value="fixed_price">מחיר קבוע (₪/חודש)</SelectItem>
                  <SelectItem value="percent_off">אחוז הנחה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {discountType === "free_months" ? "מספר חודשים" :
                 discountType === "fixed_price" ? "מחיר בש\"ח" :
                 "אחוז הנחה"}
              </Label>
              <Input
                type="number"
                placeholder={discountType === "percent_off" ? "50" : discountType === "fixed_price" ? "10" : "1"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>מקס׳ שימושים (ריק = ללא הגבלה)</Label>
              <Input
                type="number"
                placeholder="ללא הגבלה"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>תאריך תפוגה (ריק = ללא)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            צור קוד
          </Button>
        </CardContent>
      </Card>

      {/* Existing Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">קודים קיימים ({codes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : codes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין קודים עדיין</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">קוד</TableHead>
                    <TableHead className="text-right">הנחה</TableHead>
                    <TableHead className="text-right">שימושים</TableHead>
                    <TableHead className="text-right">תפוגה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>{getDiscountLabel(code.discount_type, code.discount_value)}</TableCell>
                      <TableCell>
                        {code.current_uses}
                        {code.max_uses !== null ? ` / ${code.max_uses}` : " / ∞"}
                      </TableCell>
                      <TableCell>
                        {code.expires_at ? formatDate(code.expires_at) : "ללא"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? "default" : "secondary"}>
                          {code.is_active ? "פעיל" : "מושבת"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggle(code)}
                            title={code.is_active ? "השבת" : "הפעל"}
                          >
                            {code.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(code.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

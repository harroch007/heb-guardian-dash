import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, RefreshCw, Users, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

interface CustomerGroup {
  id: string;
  name: string;
  description: string | null;
  model_name: string | null;
  is_default: boolean;
  color: string;
  created_at: string;
  member_count?: number;
}

interface ModelConfig {
  model_name: string;
}

export function AdminGroupsTab() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // New group form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newModel, setNewModel] = useState("default");
  const [newColor, setNewColor] = useState("#7C3AED");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editModel, setEditModel] = useState("default");
  const [editColor, setEditColor] = useState("#7C3AED");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [groupsRes, modelsRes, parentsRes] = await Promise.all([
      supabase.from("customer_groups" as any).select("*").order("created_at"),
      supabase.from("ai_model_config").select("model_name"),
      supabase.from("parents").select("id, group_id" as any),
    ]);

    const groupsData = (groupsRes.data || []) as any[];
    const parentsData = (parentsRes.data || []) as any[];

    // Count members per group
    const countMap: Record<string, number> = {};
    for (const p of parentsData) {
      if (p.group_id) {
        countMap[p.group_id] = (countMap[p.group_id] || 0) + 1;
      }
    }

    setGroups(groupsData.map((g: any) => ({
      ...g,
      member_count: countMap[g.id] || 0,
    })));
    setModels((modelsRes.data || []) as ModelConfig[]);
    setLoading(false);
  };

  const addGroup = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("customer_groups" as any).insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      model_name: newModel === "default" ? null : newModel,
      color: newColor,
      is_default: false,
    } as any);
    if (error) {
      toast.error("שגיאה: " + error.message);
    } else {
      toast.success("קבוצה נוצרה");
      setNewName("");
      setNewDesc("");
      setNewModel("default");
      setNewColor("#7C3AED");
      fetchAll();
    }
  };

  const startEdit = (g: CustomerGroup) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditDesc(g.description || "");
    setEditModel(g.model_name || "default");
    setEditColor(g.color);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("customer_groups" as any)
      .update({
        name: editName.trim(),
        description: editDesc.trim() || null,
        model_name: editModel === "default" ? null : editModel,
        color: editColor,
      } as any)
      .eq("id", editingId);
    if (error) {
      toast.error("שגיאה: " + error.message);
    } else {
      toast.success("קבוצה עודכנה");
      setEditingId(null);
      fetchAll();
    }
  };

  const deleteGroup = async (id: string) => {
    // First unset group_id for any parents in this group
    await (supabase.from("parents") as any).update({ group_id: null }).eq("group_id", id);
    const { error } = await (supabase.from("customer_groups") as any).delete().eq("id", id);
    if (error) {
      toast.error("שגיאה: " + error.message);
    } else {
      toast.success("קבוצה נמחקה");
      fetchAll();
    }
  };

  const COLOR_OPTIONS = [
    { value: "#7C3AED", label: "סגול" },
    { value: "#EF4444", label: "אדום" },
    { value: "#F59E0B", label: "כתום" },
    { value: "#10B981", label: "ירוק" },
    { value: "#3B82F6", label: "כחול" },
    { value: "#EC4899", label: "ורוד" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Groups Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              קבוצות לקוחות
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">צבע</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">מודל AI</TableHead>
                <TableHead className="text-right">לקוחות</TableHead>
                <TableHead className="text-right">ברירת מחדל</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  {editingId === g.id ? (
                    <>
                      <TableCell>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: editColor }} />
                      </TableCell>
                      <TableCell>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-28 h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-36 h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Select value={editModel} onValueChange={setEditModel}>
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">🔄 ברירת מחדל</SelectItem>
                            {models.map((m) => (
                              <SelectItem key={m.model_name} value={m.model_name}>{m.model_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{g.member_count}</TableCell>
                      <TableCell>{g.is_default ? "✅" : ""}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: g.color }} />
                      </TableCell>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{g.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {g.model_name || "ברירת מחדל"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{g.member_count}</Badge>
                      </TableCell>
                      <TableCell>{g.is_default ? "✅" : ""}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(g)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!g.is_default && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteGroup(g.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Add new group form */}
          <div className="flex items-center gap-2 flex-wrap border-t border-border/50 pt-4">
            <Input className="w-28" placeholder="שם קבוצה" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input className="w-36" placeholder="תיאור" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <Select value={newModel} onValueChange={setNewModel}>
              <SelectTrigger className="w-36 h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">🔄 ברירת מחדל</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.model_name} value={m.model_name}>{m.model_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newColor} onValueChange={setNewColor}>
              <SelectTrigger className="w-24 h-10 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: newColor }} />
                  <span>צבע</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addGroup} disabled={!newName.trim()}>
              <Plus className="w-4 h-4 ml-1" />
              הוסף קבוצה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

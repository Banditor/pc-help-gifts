import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Gift, Download, Plus, Trash2, Loader2, Settings, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const ADMIN_PASSWORD = "E123123";
const LEGACY_ADMIN_PASSWORD = "Rn123456";

const Admin = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const queryClient = useQueryClient();
  const [newGift, setNewGift] = useState({ name: "", description: "", quantity: "0" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedInput = passwordInput.trim();
    const isValid =
      normalizedInput === ADMIN_PASSWORD ||
      normalizedInput === ADMIN_PASSWORD.toLowerCase() ||
      normalizedInput === LEGACY_ADMIN_PASSWORD;

    if (isValid) {
      setAuthenticated(true);
      setPasswordInput("");
    } else {
      toast.error("Invalid admin password");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("gift-images").upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from("gift-images").getPublicUrl(fileName);
    return data.publicUrl;
  };

  // Fetch gifts
  const { data: gifts, isLoading: giftsLoading } = useQuery({
    queryKey: ["admin-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gifts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: authenticated,
  });

  // Fetch selections
  const { data: selections, isLoading: selectionsLoading } = useQuery({
    queryKey: ["admin-selections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_selections")
        .select("*, gifts(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: authenticated,
  });

  // Add gift
  const addGift = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      const { error } = await supabase.from("gifts").insert({
        name: newGift.name,
        description: newGift.description || null,
        image_url: imageUrl,
        quantity: parseInt(newGift.quantity) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
      setNewGift({ name: "", description: "", quantity: "0" });
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("המתנה נוספה בהצלחה");
      setUploading(false);
    },
    onError: () => {
      toast.error("Failed to add gift");
      setUploading(false);
    },
  });

  // Delete gift
  const deleteGift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gifts"] });
      toast.success("המתנה נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת המתנה"),
  });

  // Export Excel
  const exportExcel = () => {
    if (!selections || selections.length === 0) {
      toast.error("No data to export");
      return;
    }
    const rows = selections.map((s: any) => ({
      "שם עובד": s.employee_name,
      "אתר עבודה": s.work_site,
      "מוקד": s.department,
      "מתנה שנבחרה": s.gifts?.name || "לא ידוע",
      "תאריך בחירה": new Date(s.created_at).toLocaleDateString("he-IL"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "בחירות עובדים");
    XLSX.writeFile(wb, "gift_selections.xlsx");
    toast.success("הקובץ הורד בהצלחה");
  };

  // Password screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
              <Settings className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle>ממשק ניהול</CardTitle>
            <p className="text-sm text-muted-foreground">הכניסו סיסמה כדי להמשיך</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="סיסמה"
                dir="ltr"
              />
              <Button type="submit" className="w-full">כניסה</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="page-container flex items-center gap-3 py-5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">ממשק ניהול מתנות</h1>
            <p className="text-sm text-muted-foreground">ניהול מתנות וצפייה בבחירות העובדים</p>
          </div>
        </div>
      </header>

      <main className="page-container">
        <Tabs defaultValue="gifts" dir="rtl">
          <TabsList className="mb-6">
            <TabsTrigger value="gifts">ניהול מתנות</TabsTrigger>
            <TabsTrigger value="selections">בחירות עובדים</TabsTrigger>
          </TabsList>

          <TabsContent value="gifts">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  הוספת מתנה חדשה
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>שם המתנה *</Label>
                    <Input
                      value={newGift.name}
                      onChange={(e) => setNewGift((p) => ({ ...p, name: e.target.value }))}
                      placeholder="לדוגמה: רמקול בלוטוס"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>תיאור</Label>
                    <Input
                      value={newGift.description}
                      onChange={(e) => setNewGift((p) => ({ ...p, description: e.target.value }))}
                      placeholder="תיאור קצר של המתנה"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>כמות</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newGift.quantity}
                      onChange={(e) => setNewGift((p) => ({ ...p, quantity: e.target.value }))}
                      placeholder="0"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>תמונה</Label>
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imagePreview ? (
                        <img src={imagePreview} alt="תצוגה מקדימה" className="w-20 h-20 object-cover rounded-lg mx-auto" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-6 h-6" />
                          <span className="text-sm">לחצו להעלאת תמונה</span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={() => addGift.mutate()}
                  disabled={!newGift.name.trim() || addGift.isPending || uploading}
                >
                  {(addGift.isPending || uploading) ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  הוסף מתנה
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">רשימת מתנות</CardTitle>
              </CardHeader>
              <CardContent>
                {giftsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !gifts || gifts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    אין מתנות עדיין. הוסיפו את המתנה הראשונה למעלה.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>תמונה</TableHead>
                        <TableHead>שם</TableHead>
                        <TableHead>תיאור</TableHead>
                        <TableHead>כמות</TableHead>
                        <TableHead>פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gifts.map((gift) => (
                        <TableRow key={gift.id}>
                          <TableCell>
                            {gift.image_url ? (
                              <img src={gift.image_url} alt={gift.name} className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                <Gift className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{gift.name}</TableCell>
                          <TableCell className="text-muted-foreground">{gift.description || "—"}</TableCell>
                          <TableCell>{gift.quantity ?? 0}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteGift.mutate(gift.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="selections">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">בחירות עובדים</CardTitle>
                <Button variant="outline" onClick={exportExcel} className="gap-2">
                  <Download className="w-4 h-4" />
                  ייצוא Excel
                </Button>
              </CardHeader>
              <CardContent>
                {selectionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !selections || selections.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">אין בחירות עדיין.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם עובד</TableHead>
                        <TableHead>אתר עבודה</TableHead>
                        <TableHead>מוקד</TableHead>
                        <TableHead>מתנה שנבחרה</TableHead>
                        <TableHead>תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selections.map((sel: any) => (
                        <TableRow key={sel.id}>
                          <TableCell className="font-medium">{sel.employee_name}</TableCell>
                          <TableCell>{sel.work_site}</TableCell>
                          <TableCell>{sel.department}</TableCell>
                          <TableCell>{sel.gifts?.name || "לא ידוע"}</TableCell>
                          <TableCell>{new Date(sel.created_at).toLocaleDateString("he-IL")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;


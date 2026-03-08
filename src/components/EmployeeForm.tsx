import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, Building } from "lucide-react";
import type { EmployeeInfo } from "@/pages/Index";

interface Props {
  onSubmit: (info: EmployeeInfo) => void;
}

export const EmployeeForm = ({ onSubmit }: Props) => {
  const [name, setName] = useState("");
  const [workSite, setWorkSite] = useState("");
  const [department, setDepartment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && workSite.trim() && department.trim()) {
      onSubmit({ name: name.trim(), workSite: workSite.trim(), department: department.trim() });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="text-center mb-8">
        <h2 className="section-title">ברוכים הבאים!</h2>
        <p className="section-subtitle">מלאו את הפרטים שלכם כדי להמשיך לבחירת המתנה</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פרטי עובד</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                שם מלא
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="הכניסו את שמכם המלא"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workSite" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                אתר עבודה
              </Label>
              <Input
                id="workSite"
                value={workSite}
                onChange={(e) => setWorkSite(e.target.value)}
                placeholder="הכניסו את אתר העבודה"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                מוקד
              </Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="הכניסו את שם המוקד"
                required
                maxLength={100}
              />
            </div>

            <Button type="submit" className="w-full" size="lg">
              המשך לבחירת מתנה
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

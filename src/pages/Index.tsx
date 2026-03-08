import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmployeeForm } from "@/components/EmployeeForm";
import { GiftGallery } from "@/components/GiftGallery";
import { SuccessMessage } from "@/components/SuccessMessage";
import { Gift, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmployeeInfo {
  name: string;
  workSite: string;
  department: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "gallery" | "success">("form");
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);

  const handleFormSubmit = (info: EmployeeInfo) => {
    setEmployeeInfo(info);
    setStep("gallery");
  };

  const handleGiftSelected = () => {
    setStep("success");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="page-container flex items-center gap-3 py-5">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Gift className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">בחירת מתנות לעובדים</h1>
              <p className="text-sm text-muted-foreground">בחרו את המתנה המועדפת עליכם</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-2 text-muted-foreground">
            <Settings className="w-4 h-4" />
            ניהול
          </Button>
        </div>
      </header>

      <main className="page-container">
        {step === "form" && <EmployeeForm onSubmit={handleFormSubmit} />}
        {step === "gallery" && employeeInfo && (
          <GiftGallery employeeInfo={employeeInfo} onGiftSelected={handleGiftSelected} />
        )}
        {step === "success" && <SuccessMessage />}
      </main>
    </div>
  );
};

export default Index;

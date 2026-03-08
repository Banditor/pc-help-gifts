import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EmployeeInfo } from "@/pages/Index";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  employeeInfo: EmployeeInfo;
  onGiftSelected: () => void;
}

export const GiftGallery = ({ employeeInfo, onGiftSelected }: Props) => {
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: gifts, isLoading } = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("*")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data as Tables<"gifts">[];
    },
  });

  const handleSubmit = async () => {
    if (!selectedGift) {
      toast.error("יש לבחור מתנה לפני השליחה");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("gift_selections").insert({
      employee_name: employeeInfo.name,
      work_site: employeeInfo.workSite,
      department: employeeInfo.department,
      gift_id: selectedGift,
    });

    if (error) {
      toast.error("אירעה שגיאה בשליחת הבחירה");
      console.error(error);
    } else {
      onGiftSelected();
    }
    setSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!gifts || gifts.length === 0) {
    return (
      <div className="text-center py-20">
        <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">אין מתנות זמינות כרגע</p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="section-title">בחרו את המתנה שלכם</h2>
        <p className="section-subtitle">
          שלום {employeeInfo.name}, לחצו על המתנה המועדפת עליכם
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {gifts.map((gift) => (
          <div
            key={gift.id}
            onClick={() => setSelectedGift(gift.id)}
            className={`gift-card ${selectedGift === gift.id ? "gift-card-selected" : ""}`}
          >
            {gift.image_url ? (
              <div className="aspect-square overflow-hidden">
                <img
                  src={gift.image_url}
                  alt={gift.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square bg-muted flex items-center justify-center">
                <Gift className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{gift.name}</h3>
                {selectedGift === gift.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
              {gift.description && (
                <p className="text-sm text-muted-foreground mt-1">{gift.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!selectedGift || submitting}
          className="min-w-[200px]"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
          ) : null}
          אישור בחירה
        </Button>
      </div>
    </div>
  );
};

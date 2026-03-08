import { CheckCircle } from "lucide-react";

export const SuccessMessage = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-primary" />
      </div>
      <h2 className="section-title">הבחירה נשמרה בהצלחה!</h2>
      <p className="section-subtitle max-w-md">
        תודה רבה על הבחירה. המתנה שלכם תגיע אליכם בקרוב.
      </p>
    </div>
  );
};

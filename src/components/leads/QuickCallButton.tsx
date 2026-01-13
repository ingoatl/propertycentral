import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CallDialog } from "@/components/communications/CallDialog";

interface QuickCallButtonProps {
  leadId: string;
  leadPhone: string | null;
  leadName: string;
}

const QuickCallButton = ({ leadId, leadPhone, leadName }: QuickCallButtonProps) => {
  const [showCall, setShowCall] = useState(false);

  const handleQuickCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!leadPhone) {
      toast.error("Lead has no phone number");
      return;
    }

    setShowCall(true);
  };

  if (!leadPhone) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1 pt-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={handleQuickCall}
        >
          <Phone className="h-3 w-3" />
        </Button>
      </div>

      <CallDialog
        open={showCall}
        onOpenChange={setShowCall}
        contactName={leadName}
        contactPhone={leadPhone}
        contactType="lead"
      />
    </>
  );
};

export default QuickCallButton;

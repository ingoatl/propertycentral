import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { CallDialog } from "@/components/communications/CallDialog";

interface DirectCallButtonProps {
  leadId: string;
  leadPhone: string | null;
  leadName: string;
  leadAddress?: string | null;
}

const DirectCallButton = ({ leadId, leadPhone, leadName, leadAddress }: DirectCallButtonProps) => {
  const [showCall, setShowCall] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
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
      <Button 
        variant="outline" 
        size="sm" 
        className="flex-1"
        onClick={handleClick}
      >
        <Phone className="h-4 w-4 mr-2" />
        Call
      </Button>

      <CallDialog
        open={showCall}
        onOpenChange={setShowCall}
        contactName={leadName}
        contactPhone={leadPhone}
        contactType="lead"
        contactAddress={leadAddress}
      />
    </>
  );
};

export default DirectCallButton;

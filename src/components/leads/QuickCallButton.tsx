import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickCallButtonProps {
  leadId: string;
  leadPhone: string | null;
  leadName: string;
}

const QuickCallButton = ({ leadId, leadPhone, leadName }: QuickCallButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!leadPhone) {
      toast.error("Lead has no phone number");
      return;
    }

    setIsLoading(true);

    try {
      const firstName = leadName?.split(' ')[0] || 'there';
      const message = `Hi ${firstName}, this is Ingo from PeachHaus. I hope you're having a wonderful day. I wanted to personally reach out because I'm genuinely interested in learning more about your property and how we might be able to help. Whether you're exploring options or ready to move forward, I'm here to answer any questions and make this process as smooth as possible for you. Feel free to call me back anytime - I'd love to connect. Take care!`;

      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-call', {
        body: {
          leadId,
          message,
        }
      });

      if (error) {
        console.error('Quick call error:', error);
        toast.error(`Failed to call: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success(`Calling ${leadName}...`);
      } else {
        toast.error(data?.error || "Failed to initiate call");
      }
    } catch (err) {
      console.error('Quick call error:', err);
      toast.error("Failed to initiate call");
    } finally {
      setIsLoading(false);
    }
  };

  if (!leadPhone) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 pt-1">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        onClick={handleQuickCall}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Phone className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
};

export default QuickCallButton;

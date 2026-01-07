import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendStripeAuthButtonProps {
  leadId: string;
  email: string | null;
  name: string | null;
  propertyAddress?: string | null;
  stage?: string | null;
  className?: string;
}

export function SendStripeAuthButton({ 
  leadId, 
  email, 
  name, 
  propertyAddress,
  stage,
  className 
}: SendStripeAuthButtonProps) {
  const [isSending, setIsSending] = useState(false);

  // Only show for leads with email and in certain stages
  const validStages = ['contract_signed', 'ach_form_pending', 'ach_form_signed', 'discovery_call_done', 'contract_out'];
  const shouldShow = email && (!stage || validStages.includes(stage));

  if (!shouldShow) {
    return null;
  }

  const handleSend = async () => {
    if (!email) {
      toast.error("No email address available for this lead");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-stripe-authorization-email', {
        body: {
          leadId,
          email,
          name,
          propertyAddress
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Payment authorization email sent successfully!");
    } catch (error: any) {
      console.error("Error sending Stripe auth email:", error);
      toast.error(error.message || "Failed to send payment authorization email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      onClick={handleSend}
      disabled={isSending}
      className={`bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white ${className || ''}`}
      size="sm"
    >
      {isSending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          Send ACH/Payment Setup
        </>
      )}
    </Button>
  );
}

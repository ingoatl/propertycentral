import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendOwnerPaymentRequestButtonProps {
  ownerId: string;
  email: string | null;
  name: string;
  stripeCustomerId: string | null;
  paymentMethod?: string | null; // Added to check if payment method is actually set up
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SendOwnerPaymentRequestButton({
  ownerId,
  email,
  name,
  stripeCustomerId,
  paymentMethod,
  className,
  variant = "outline",
  size = "sm",
}: SendOwnerPaymentRequestButtonProps) {
  const [isSending, setIsSending] = useState(false);

  // Check if payment method is already set up - need BOTH stripe customer AND payment method
  const hasPaymentMethod = !!stripeCustomerId && !!paymentMethod;

  if (!email) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className={className}
        title="No email address available"
      >
        <CreditCard className="w-4 h-4 mr-2" />
        No Email
      </Button>
    );
  }

  // Show disabled state if payment method exists
  if (hasPaymentMethod) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className={`text-green-600 border-green-200 bg-green-50 ${className || ''}`}
        title="Payment method already on file"
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Payment Set Up
      </Button>
    );
  }

  const handleSendRequest = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-owner-payment-request', {
        body: {
          ownerId,
          email,
          name,
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Payment authorization email sent!", {
        description: `Sent to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending payment request:", error);
      toast.error(error.message || "Failed to send payment request email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      onClick={handleSendRequest}
      disabled={isSending}
      variant={variant}
      size={size}
      className={`gap-2 ${className || ''}`}
      title="Send payment authorization request"
    >
      {isSending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          📧 Payment Request
        </>
      )}
    </Button>
  );
}

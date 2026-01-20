import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ShieldCheck, Mail, MessageSquare, Copy, Loader2, Check, ChevronDown } from "lucide-react";

interface SendAuthorizationButtonProps {
  leadId: string;
  email: string | null;
  phone: string | null;
  name: string;
  propertyAddress: string | null;
  paymentMethod: string | null;
  className?: string;
}

export const SendAuthorizationButton = ({
  leadId,
  email,
  phone,
  name,
  propertyAddress,
  paymentMethod,
  className,
}: SendAuthorizationButtonProps) => {
  const [isSending, setIsSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If already authorized, show badge
  if (paymentMethod) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={`bg-emerald-50 text-emerald-700 border-emerald-200 ${className}`}
      >
        <Check className="h-4 w-4 mr-1.5" />
        Authorized
      </Button>
    );
  }

  // If no email or phone, show disabled
  if (!email && !phone) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={className}
      >
        <ShieldCheck className="h-4 w-4 mr-1.5" />
        No Contact
      </Button>
    );
  }

  const handleSendEmail = async () => {
    if (!email) {
      toast.error("Lead has no email address");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-lead-authorization-request", {
        body: { leadId, email, name, propertyAddress },
      });

      if (error) throw error;

      toast.success("Authorization email sent!", {
        description: `Sent to ${email}`,
      });
    } catch (err: any) {
      console.error("Error sending authorization:", err);
      toast.error("Failed to send authorization", {
        description: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phone) {
      toast.error("Lead has no phone number");
      return;
    }

    setIsSending(true);
    try {
      const authUrl = `https://propertycentral.lovable.app/lead-payment-setup?lead=${leadId}`;
      const message = `Hi ${name.split(" ")[0]}, please set up your payment method for PeachHaus property management: ${authUrl}`;

      const { error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          leadId,
          phone,
          message,
          fromNumber: "+14048006804",
        },
      });

      if (error) throw error;

      toast.success("Authorization SMS sent!", {
        description: `Sent to ${phone}`,
      });
    } catch (err: any) {
      console.error("Error sending SMS:", err);
      toast.error("Failed to send SMS", {
        description: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    const authUrl = `https://propertycentral.lovable.app/lead-payment-setup?lead=${leadId}`;
    await navigator.clipboard.writeText(authUrl);
    setCopiedLink(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isSending}
          className={`bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 ${className}`}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-1.5" />
          )}
          {isSending ? "Sending..." : "Authorization"}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {email && (
          <DropdownMenuItem onClick={handleSendEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Send via Email
          </DropdownMenuItem>
        )}
        {phone && (
          <DropdownMenuItem onClick={handleSendSMS}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Send via SMS
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleCopyLink}>
          {copiedLink ? (
            <Check className="h-4 w-4 mr-2 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copiedLink ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

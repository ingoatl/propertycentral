import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, Loader2, Mail, MessageSquare, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendPaymentLinkButtonProps {
  leadId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  className?: string;
}

export function SendPaymentLinkButton({ 
  leadId, 
  email, 
  phone,
  name,
  className 
}: SendPaymentLinkButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!email && !phone) {
    return null;
  }

  const handleSend = async (sendVia: "email" | "sms" | "copy") => {
    setIsSending(true);
    setCopied(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          leadId,
          sendVia: sendVia === "copy" ? null : sendVia,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        if (sendVia === "copy") {
          await navigator.clipboard.writeText(data.url);
          setCopied(true);
          toast.success("Payment link copied to clipboard!");
          setTimeout(() => setCopied(false), 3000);
        } else if (sendVia === "email") {
          toast.success("Payment link sent via email!");
        } else if (sendVia === "sms") {
          toast.success("Payment link sent via SMS!");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create payment link");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isSending}
          variant="outline"
          size="sm"
          className={className}
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Link className="w-4 h-4 mr-2" />
              Payment Link
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {email && (
          <DropdownMenuItem onClick={() => handleSend("email")}>
            <Mail className="w-4 h-4 mr-2" />
            Send via Email
          </DropdownMenuItem>
        )}
        {phone && (
          <DropdownMenuItem onClick={() => handleSend("sms")}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Send via SMS
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => handleSend("copy")}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

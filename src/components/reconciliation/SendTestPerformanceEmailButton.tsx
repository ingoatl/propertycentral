import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

export function SendTestPerformanceEmailButton() {
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    try {
      setSending(true);
      
      const { data, error } = await supabase.functions.invoke('send-monthly-report', {
        body: { 
          isTestEmail: true 
        }
      });

      if (error) throw error;

      toast.success("Test performance email sent successfully! Check your inbox.");
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Button 
      onClick={handleSendTest} 
      disabled={sending}
      variant="outline"
      className="gap-2"
    >
      {sending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending Test Email...
        </>
      ) : (
        <>
          <Mail className="w-4 h-4" />
          Send Test Performance Email
        </>
      )}
    </Button>
  );
}

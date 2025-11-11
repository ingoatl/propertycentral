import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

export function SendTestTeamDigestButton() {
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    try {
      setSending(true);
      toast.loading("Sending test team performance digest...");
      
      const { data, error } = await supabase.functions.invoke('send-team-performance-digest');

      if (error) throw error;

      toast.dismiss();
      toast.success("Test team performance digest sent successfully! Check your inbox.");
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.dismiss();
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
      size="sm"
      className="gap-2"
    >
      {sending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <Mail className="w-4 h-4" />
          Test Team Digest
        </>
      )}
    </Button>
  );
}

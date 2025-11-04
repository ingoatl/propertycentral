import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export function RescanEmailsButton() {
  const [scanning, setScanning] = useState(false);

  const handleRescan = async () => {
    if (!confirm("This will rescan emails from the last 6 weeks with improved owner name and property address matching. Continue?")) {
      return;
    }

    try {
      setScanning(true);
      toast.loading("Rescanning emails from the last 6 weeks...");

      // Trigger new scan with forceRescan flag
      const { data, error } = await supabase.functions.invoke('scan-gmail', {
        body: { forceRescan: true }
      });

      if (error) throw error;

      toast.dismiss();
      toast.success(`Rescan complete! Processed ${data.emailsProcessed} emails, generated ${data.insightsGenerated} insights with enhanced owner and property matching`);
    } catch (error: any) {
      console.error('Error rescanning emails:', error);
      toast.dismiss();
      toast.error('Failed to rescan emails');
    } finally {
      setScanning(false);
    }
  };

  return (
    <Button
      onClick={handleRescan}
      disabled={scanning}
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
      {scanning ? 'Rescanning...' : 'Rescan All Emails'}
    </Button>
  );
}

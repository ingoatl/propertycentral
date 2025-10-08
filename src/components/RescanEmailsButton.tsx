import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export function RescanEmailsButton() {
  const [scanning, setScanning] = useState(false);

  const handleRescan = async () => {
    if (!confirm("This will delete all existing email insights and rescan emails with the improved AI analysis. Continue?")) {
      return;
    }

    try {
      setScanning(true);
      toast.loading("Clearing old insights and rescanning emails...");

      // Delete all existing insights
      const { error: deleteError } = await supabase
        .from('email_insights')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      // Trigger new scan
      const { data, error } = await supabase.functions.invoke('scan-gmail');

      if (error) throw error;

      toast.dismiss();
      toast.success(`Rescan complete! Processed ${data.emailsProcessed} emails, generated ${data.insightsGenerated} insights with expense detection and sentiment analysis`);
      
      // Reload the page to show new insights
      setTimeout(() => window.location.reload(), 2000);
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

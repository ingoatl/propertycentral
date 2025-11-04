import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Loader2 } from "lucide-react";
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
    <div className="space-y-4">
      {scanning && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="ml-2">
            <div className="space-y-2">
              <p className="font-medium">Scanning emails from the last 6 weeks...</p>
              <Progress value={100} className="w-full animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Processing emails and extracting insights. This may take a few moments.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handleRescan}
        disabled={scanning}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
        {scanning ? 'Rescanning...' : 'Rescan All Emails'}
      </Button>
    </div>
  );
}

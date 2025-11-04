import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DataCleanupPanel() {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<any>(null);

  const handleCleanup = async () => {
    if (!confirm('This will delete all contaminated expenses (from internal emails, duplicates, suspicious descriptions). Continue?')) {
      return;
    }

    setIsCleaningUp(true);
    setCleanupResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-contaminated-expenses');

      if (error) throw error;

      setCleanupResults(data);
      toast.success(data.message || 'Cleanup completed successfully');
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Failed to clean up data: ' + (error as Error).message);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleFullRescan = async () => {
    if (!confirm('This will trigger a full 60-day email rescan with the new filtering rules. This may take several minutes. Continue?')) {
      return;
    }

    setIsRescanning(true);

    try {
      const { data, error } = await supabase.functions.invoke('scan-gmail', {
        body: { forceRescan: true }
      });

      if (error) throw error;

      toast.success(`Email rescan completed: ${data.emailsProcessed} emails processed, ${data.insightsGenerated} insights generated`);
    } catch (error) {
      console.error('Rescan error:', error);
      toast.error('Failed to rescan emails: ' + (error as Error).message);
    } finally {
      setIsRescanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-destructive/50 bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-sm">
          <strong>Data Integrity Issue Detected:</strong> Some expenses were incorrectly created from internal emails or contain aggregated data from multiple properties. Use the cleanup tool to fix this.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expense Data Cleanup & Email Rescan</CardTitle>
          <CardDescription>
            Fix contaminated expense data and rescan emails with improved filtering
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Step 1: Clean Up Contaminated Data
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Delete all contaminated expenses:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground mb-3">
                <li>Expenses from @peachhausgroup.com senders</li>
                <li>Expenses with "Multiple expenses logged" descriptions</li>
                <li>Duplicate expenses (same order number)</li>
                <li>Expenses mentioning multiple properties</li>
              </ul>
              <Button 
                onClick={handleCleanup}
                disabled={isCleaningUp}
                variant="destructive"
                size="sm"
              >
                {isCleaningUp ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Cleaning Up...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Run Cleanup
                  </>
                )}
              </Button>

              {cleanupResults && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Cleanup Complete</span>
                  </div>
                  <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                    <li>Deleted expenses: {cleanupResults.deletedExpenses}</li>
                    <li>Deleted line items: {cleanupResults.deletedLineItems}</li>
                    <li>Updated reconciliations: {cleanupResults.affectedReconciliations}</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Step 2: Rescan Emails (After Cleanup)
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                After cleanup, rescan all emails from the last 60 days with improved filtering:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground mb-3">
                <li>Filters out internal PeachHaus emails</li>
                <li>Improved Amazon order detection</li>
                <li>Better property matching from delivery addresses</li>
                <li>Validates all expense data before creating</li>
              </ul>
              <Button 
                onClick={handleFullRescan}
                disabled={isRescanning || isCleaningUp}
                size="sm"
              >
                {isRescanning ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Rescanning Emails...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rescan Emails
                  </>
                )}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                {cleanupResults 
                  ? "✓ Cleanup complete. Ready to rescan." 
                  : "Run cleanup first for best results."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

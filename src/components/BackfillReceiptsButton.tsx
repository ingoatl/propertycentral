import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

export const BackfillReceiptsButton = () => {
  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleBackfill = async () => {
    setIsBackfilling(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('backfill-expense-receipts');
      
      if (error) throw error;
      
      if (data.processed > 0) {
        toast.success(`Successfully created ${data.processed} email receipts!`);
      } else {
        toast.info('All expenses already have receipts');
      }
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast.error('Failed to create receipts');
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <Button
      onClick={handleBackfill}
      disabled={isBackfilling}
      variant="outline"
      className="gap-2"
    >
      {isBackfilling ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Creating Receipts...
        </>
      ) : (
        <>
          <FileText className="w-4 h-4" />
          Generate Missing Receipts
        </>
      )}
    </Button>
  );
};

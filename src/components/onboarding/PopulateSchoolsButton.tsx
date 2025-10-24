import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const PopulateSchoolsButton = ({ onComplete }: { onComplete?: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePopulateSchools = async () => {
    setIsLoading(true);
    
    try {
      toast.info("Starting AI school lookup for all properties...");
      
      const { data, error } = await supabase.functions.invoke("populate-all-schools");

      if (error) {
        console.error("Error populating schools:", error);
        toast.error("Failed to populate schools: " + error.message);
        return;
      }

      console.log("Populate schools result:", data);
      
      const successCount = data.results?.filter((r: any) => r.status === "success").length || 0;
      const errorCount = data.results?.filter((r: any) => r.status === "error").length || 0;
      const skippedCount = data.results?.filter((r: any) => r.status === "skipped").length || 0;

      if (successCount > 0) {
        toast.success(`Successfully populated schools for ${successCount} properties`);
      }
      if (skippedCount > 0) {
        toast.info(`Skipped ${skippedCount} properties (already complete)`);
      }
      if (errorCount > 0) {
        toast.warning(`Failed to populate ${errorCount} properties`);
      }

      onComplete?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while populating schools");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePopulateSchools}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Populating Schools...
        </>
      ) : (
        <>
          <GraduationCap className="h-4 w-4" />
          AI Populate Schools
        </>
      )}
    </Button>
  );
};

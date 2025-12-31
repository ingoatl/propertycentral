import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CreateReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateReconciliationDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateReconciliationDialogProps) => {
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ["properties-with-owners-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, owner_id, property_owners(name)")
        .not("owner_id", "is", null)
        .is("offboarded_at", null) // Exclude offboarded properties
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Generate last 6 months - start from LAST month (not current month)
  // Reconciliations are typically done for the previous month
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1 - i); // Start from last month
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
      label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });

  const handleCreate = async () => {
    if (!selectedProperty || !selectedMonth) {
      toast.error("Please select both property and month");
      return;
    }

    setIsCreating(true);
    try {
      const response = await supabase.functions.invoke("create-reconciliation", {
        body: {
          property_id: selectedProperty,
          month: selectedMonth,
        },
      });

      // Check for successful creation
      if (response.data?.success) {
        toast.success("Reconciliation created successfully");
        onSuccess();
        onOpenChange(false);
        setSelectedProperty("");
        setSelectedMonth("");
        setIsCreating(false);
        return;
      }

      // If we get here, something went wrong
      throw new Error(response.data?.error || response.error?.message || "Failed to create reconciliation");
    } catch (error: any) {
      console.error("Error creating reconciliation:", error);
      
      // Try to parse the error response
      const errorMessage = error.message || "Failed to create reconciliation";
      
      // Check if this is a duplicate reconciliation error by making a direct query
      if (errorMessage.includes("non-2xx") || errorMessage.includes("409")) {
        try {
          // Query to check if there's an existing reconciliation
          const firstDay = new Date(selectedMonth);
          const monthString = firstDay.toISOString().split("T")[0];
          
          const { data: existingRec } = await supabase
            .from("monthly_reconciliations")
            .select("id, status")
            .eq("property_id", selectedProperty)
            .eq("reconciliation_month", monthString)
            .maybeSingle();

          if (existingRec && existingRec.status === "draft") {
            const shouldReplace = window.confirm(
              `A draft reconciliation already exists for this property and month. Do you want to delete it and create a new one?`
            );
            
            if (shouldReplace) {
              // Delete the existing reconciliation and line items
              await supabase
                .from("reconciliation_line_items")
                .delete()
                .eq("reconciliation_id", existingRec.id);
              
              await supabase
                .from("monthly_reconciliations")
                .delete()
                .eq("id", existingRec.id);
              
              // Retry creation
              const retryResponse = await supabase.functions.invoke("create-reconciliation", {
                body: {
                  property_id: selectedProperty,
                  month: selectedMonth,
                },
              });
              
              if (retryResponse.data?.success) {
                toast.success("Reconciliation created successfully!");
                onSuccess();
                onOpenChange(false);
                setSelectedProperty("");
                setSelectedMonth("");
                setIsCreating(false);
                return;
              }
            } else {
              setIsCreating(false);
              return;
            }
          } else if (existingRec) {
            toast.error("A reconciliation already exists for this property and month (already approved or sent)");
            setIsCreating(false);
            return;
          }
        } catch (queryError) {
          console.error("Error checking for existing reconciliation:", queryError);
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start New Reconciliation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Property</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((property: any) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name} - {property.property_owners?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreate}
            disabled={isCreating || !selectedProperty || !selectedMonth}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Generate Reconciliation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
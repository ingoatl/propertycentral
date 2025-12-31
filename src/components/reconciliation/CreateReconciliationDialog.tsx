import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface CreateReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultMonth?: string;
}

export const CreateReconciliationDialog = ({
  open,
  onOpenChange,
  onSuccess,
  defaultMonth,
}: CreateReconciliationDialogProps) => {
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Generate last 6 months - start from LAST month (not current month)
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1 - i);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
      label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });

  // Set default month when dialog opens
  useEffect(() => {
    if (open && defaultMonth) {
      setSelectedMonth(defaultMonth);
    } else if (open && !selectedMonth) {
      setSelectedMonth(months[0].value);
    }
  }, [open, defaultMonth]);

  // Fetch properties with billing_status = 'active' (chargeable)
  const { data: properties } = useQuery({
    queryKey: ["properties-with-owners-active-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, owner_id, billing_status, property_owners(name, service_type)")
        .not("owner_id", "is", null)
        .is("offboarded_at", null)
        .eq("billing_status", "active") // Only show chargeable properties
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch existing reconciliations to show which properties already have one for selected month
  const { data: existingReconciliations } = useQuery({
    queryKey: ["existing-reconciliations", selectedMonth],
    queryFn: async () => {
      if (!selectedMonth) return [];
      const { data, error } = await supabase
        .from("monthly_reconciliations")
        .select("property_id")
        .eq("reconciliation_month", selectedMonth);

      if (error) throw error;
      return data?.map(r => r.property_id) || [];
    },
    enabled: !!selectedMonth,
  });

  // Properties with reconciliation status for the selected month
  const propertiesWithStatus = properties?.map((property: any) => ({
    ...property,
    hasReconciliation: existingReconciliations?.includes(property.id) || false,
  })) || [];

  const propertiesWithoutReconciliation = propertiesWithStatus.filter(p => !p.hasReconciliation);
  const totalProperties = propertiesWithStatus.length;
  const reconciledCount = propertiesWithStatus.filter(p => p.hasReconciliation).length;

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

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start New Reconciliation</DialogTitle>
          <DialogDescription>
            Create a monthly reconciliation for an active property
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Progress indicator */}
          {selectedMonth && totalProperties > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedMonthLabel} progress
              </span>
              <Badge variant={reconciledCount === totalProperties ? "default" : "secondary"}>
                {reconciledCount} of {totalProperties} reconciled
              </Badge>
            </div>
          )}

          {/* Month selector first */}
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

          {/* Property selector with enhanced display */}
          <div className="space-y-2">
            <Label>Property</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {propertiesWithStatus?.map((property: any) => (
                  <SelectItem 
                    key={property.id} 
                    value={property.id}
                    disabled={property.hasReconciliation}
                  >
                    <div className="flex items-start gap-2 py-1">
                      {property.hasReconciliation ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">{property.name}</span>
                        <span className="text-xs text-muted-foreground">{property.address}</span>
                        <span className="text-xs text-muted-foreground">
                          Owner: {property.property_owners?.name} • {property.property_owners?.service_type === 'full_service' ? 'Full-Service' : 'Co-Hosting'}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {propertiesWithoutReconciliation.length === 0 && selectedMonth && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                All properties have reconciliations for this month
              </p>
            )}
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
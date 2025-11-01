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
    queryKey: ["properties-with-owners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, owner_id, property_owners(name)")
        .not("owner_id", "is", null)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Generate last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
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
      const { data, error } = await supabase.functions.invoke("create-reconciliation", {
        body: {
          property_id: selectedProperty,
          month: selectedMonth,
        },
      });

      if (error) throw error;

      toast.success("Reconciliation created successfully");
      onSuccess();
      onOpenChange(false);
      setSelectedProperty("");
      setSelectedMonth("");
    } catch (error: any) {
      console.error("Error creating reconciliation:", error);
      toast.error(error.message || "Failed to create reconciliation");
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
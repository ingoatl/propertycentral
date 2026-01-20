import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Wrench, Home, User } from "lucide-react";

interface StartWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Property {
  id: string;
  name: string | null;
  address: string | null;
  owner_id: string | null;
}

interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  specialty: string[];
  phone: string;
}

export function StartWorkOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: StartWorkOrderDialogProps) {
  const queryClient = useQueryClient();
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "emergency">("normal");
  const [category, setCategory] = useState<string>("general_maintenance");

  // Fetch properties
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: ["properties-for-work-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, owner_id")
        .is("offboarded_at", null)
        .order("name");
      
      if (error) throw error;
      return (data || []) as Property[];
    },
    enabled: open,
  });

  // Generate full property label
  const getPropertyLabel = (property: Property) => {
    if (property.name && property.address) {
      return `${property.name} — ${property.address}`;
    }
    return property.address || property.name || "Unnamed Property";
  };

  // Fetch vendors
  const { data: vendors = [], isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors-for-work-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, specialty, phone")
        .in("status", ["active", "preferred"])
        .order("name");
      
      if (error) throw error;
      return (data || []) as Vendor[];
    },
    enabled: open,
  });

  // Create work order mutation
  const createWorkOrderMutation = useMutation({
    mutationFn: async () => {
      // Generate a work order number
      const woNumber = `WO-${Date.now().toString().slice(-6)}`;
      
      const insertData = {
        property_id: selectedProperty,
        assigned_vendor_id: selectedVendor,
        title,
        description,
        category,
        urgency: priority,
        status: "dispatched" as const, // Set to dispatched since vendor is assigned
      };
      
      const { data, error } = await supabase
        .from("work_orders")
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, woNumber };
    },
    onSuccess: async (workOrder) => {
      // Send SMS to vendor notifying them of the new work order
      const vendor = vendors.find(v => v.id === selectedVendor);
      const property = properties.find(p => p.id === selectedProperty);
      const propertyLabel = property ? getPropertyLabel(property) : "Property";
      const urgencyLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
      
      if (vendor?.phone) {
        try {
          const message = `🔧 NEW WORK ORDER ${workOrder.woNumber}\n\n` +
            `Job: ${title}\n` +
            `Location: ${propertyLabel}\n` +
            `Priority: ${urgencyLabel}\n\n` +
            `Reply CONFIRM to accept, or DECLINE [reason] if unavailable.`;
          
          const { error: smsError } = await supabase.functions.invoke("ghl-send-sms", {
            body: {
              vendorId: vendor.id,
              phone: vendor.phone,
              message,
            },
          });
          
          if (smsError) {
            console.error("Failed to send vendor notification SMS:", smsError);
            toast.error("Work order created but SMS notification failed");
          } else {
            console.log("Vendor notification SMS sent successfully");
          }
        } catch (smsError) {
          console.error("Failed to send vendor notification SMS:", smsError);
        }
      }
      
      toast.success(`Work order ${workOrder.woNumber} created and vendor notified!`);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-work-orders"] });
      
      // Reset form
      setSelectedProperty("");
      setSelectedVendor("");
      setTitle("");
      setDescription("");
      setPriority("normal");
      setCategory("general_maintenance");
      
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create work order: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!selectedProperty || !selectedVendor || !title.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    createWorkOrderMutation.mutate();
  };

  const getVendorLabel = (vendor: Vendor) => {
    const specialties = vendor.specialty?.slice(0, 2).map(s => 
      s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ).join(', ') || '';
    return `${vendor.name}${vendor.company_name ? ` (${vendor.company_name})` : ''}${specialties ? ` - ${specialties}` : ''}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Start Work Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Property Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5" />
              Property *
            </Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProperties ? "Loading..." : "Select property"} />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id} className="text-sm">
                    {getPropertyLabel(property)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Assign Vendor *
            </Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger>
                <SelectValue placeholder={loadingVendors ? "Loading..." : "Select vendor"} />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {getVendorLabel(vendor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Work Order Title *</Label>
            <Input
              placeholder="e.g., HVAC repair, Plumbing leak fix..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(val) => setPriority(val as "low" | "normal" | "high" | "emergency")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the work to be done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createWorkOrderMutation.isPending || !selectedProperty || !selectedVendor || !title.trim()}
          >
            {createWorkOrderMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Create & Notify Vendor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

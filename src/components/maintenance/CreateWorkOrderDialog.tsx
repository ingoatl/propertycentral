import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { WORK_ORDER_CATEGORIES } from "@/types/maintenance";

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultPropertyId?: string;
}

const CreateWorkOrderDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultPropertyId 
}: CreateWorkOrderDialogProps) => {
  const [formData, setFormData] = useState({
    property_id: defaultPropertyId || "",
    title: "",
    description: "",
    category: "",
    urgency: "normal" as const,
    source: "internal",
    reported_by: "",
    reported_by_email: "",
    reported_by_phone: "",
    access_instructions: "",
    estimated_cost: "",
  });

  // Fetch properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("offboarded_at", null)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const createWorkOrder = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          property_id: formData.property_id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          urgency: formData.urgency,
          source: formData.source,
          reported_by: formData.reported_by || null,
          reported_by_email: formData.reported_by_email || null,
          reported_by_phone: formData.reported_by_phone || null,
          access_instructions: formData.access_instructions || null,
          estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
          status: "new",
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: data.id,
        action: "Work order created",
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        new_status: "new",
      });

      return data;
    },
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create work order: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      property_id: defaultPropertyId || "",
      title: "",
      description: "",
      category: "",
      urgency: "normal",
      source: "internal",
      reported_by: "",
      reported_by_email: "",
      reported_by_phone: "",
      access_instructions: "",
      estimated_cost: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!formData.property_id || !formData.title || !formData.category) {
              toast.error("Please fill in required fields");
              return;
            }
            createWorkOrder.mutate();
          }}
          className="space-y-6"
        >
          {/* Property Selection */}
          <div className="space-y-2">
            <Label>Property *</Label>
            <Select
              value={formData.property_id}
              onValueChange={(value) => setFormData({ ...formData, property_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
              {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    <span className="flex flex-col">
                      <span className="font-medium">{property.name || "Unnamed Property"}</span>
                      {property.address && (
                        <span className="text-xs text-muted-foreground">{property.address}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          {/* Category & Urgency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value: any) => setFormData({ ...formData, urgency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Can wait</SelectItem>
                  <SelectItem value="normal">Normal - Within a few days</SelectItem>
                  <SelectItem value="high">High - Needs attention soon</SelectItem>
                  <SelectItem value="emergency">Emergency - Immediate action</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the issue, including any relevant context..."
              rows={4}
              required
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal (Staff)</SelectItem>
                <SelectItem value="guest_report">Guest Report</SelectItem>
                <SelectItem value="inspection">Inspection Finding</SelectItem>
                <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                <SelectItem value="owner_request">Owner Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reporter Info */}
          <div className="space-y-4">
            <Label className="text-base">Reporter Information (Optional)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reported_by" className="text-sm font-normal">Name</Label>
                <Input
                  id="reported_by"
                  value={formData.reported_by}
                  onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
                  placeholder="Guest name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reported_by_email" className="text-sm font-normal">Email</Label>
                <Input
                  id="reported_by_email"
                  type="email"
                  value={formData.reported_by_email}
                  onChange={(e) => setFormData({ ...formData, reported_by_email: e.target.value })}
                  placeholder="guest@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reported_by_phone" className="text-sm font-normal">Phone</Label>
                <Input
                  id="reported_by_phone"
                  value={formData.reported_by_phone}
                  onChange={(e) => setFormData({ ...formData, reported_by_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_cost">Estimated Cost ($)</Label>
              <Input
                id="estimated_cost"
                type="number"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_instructions">Access Instructions</Label>
              <Input
                id="access_instructions"
                value={formData.access_instructions}
                onChange={(e) => setFormData({ ...formData, access_instructions: e.target.value })}
                placeholder="Lockbox code, gate code, etc."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkOrder.isPending}>
              {createWorkOrder.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWorkOrderDialog;

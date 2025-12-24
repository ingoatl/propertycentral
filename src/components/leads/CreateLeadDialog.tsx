import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { LeadStage, LEAD_STAGES } from "@/types/leads";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPPORTUNITY_SOURCES = [
  "PeachHaus Discovery Call",
  "Realtor Referral",
  "Website Inquiry",
  "Phone Call",
  "Email Inquiry",
  "Social Media",
  "Existing Owner Referral",
  "Other",
];

const CreateLeadDialog = ({ open, onOpenChange }: CreateLeadDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    opportunity_source: "",
    opportunity_value: "",
    property_address: "",
    property_type: "",
    stage: "new_lead" as LeadStage,
    notes: "",
  });

  const createLead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          opportunity_source: formData.opportunity_source || null,
          opportunity_value: formData.opportunity_value ? parseFloat(formData.opportunity_value) : 0,
          property_address: formData.property_address || null,
          property_type: formData.property_type || null,
          stage: formData.stage,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: data.id,
        action: "Lead created",
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        new_stage: formData.stage,
      });

      // Trigger automation for new lead
      if (formData.stage === 'new_lead') {
        try {
          await supabase.functions.invoke('process-lead-stage-change', {
            body: { leadId: data.id, newStage: 'new_lead', previousStage: null }
          });
        } catch (e) {
          console.log('Automation queued');
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead created successfully");
      onOpenChange(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        opportunity_source: "",
        opportunity_value: "",
        property_address: "",
        property_type: "",
        stage: "new_lead",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create lead: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createLead.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            
            <div>
              <Label htmlFor="source">Opportunity Source</Label>
              <Select
                value={formData.opportunity_source}
                onValueChange={(value) => setFormData({ ...formData, opportunity_source: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="value">Opportunity Value ($)</Label>
              <Input
                id="value"
                type="number"
                value={formData.opportunity_value}
                onChange={(e) => setFormData({ ...formData, opportunity_value: e.target.value })}
                placeholder="0"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="address">Property Address</Label>
              <Input
                id="address"
                value={formData.property_address}
                onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                placeholder="123 Main St, Atlanta, GA"
              />
            </div>
            
            <div>
              <Label htmlFor="type">Property Type</Label>
              <Select
                value={formData.property_type}
                onValueChange={(value) => setFormData({ ...formData, property_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_family">Single Family</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="townhouse">Townhouse</SelectItem>
                  <SelectItem value="multi_family">Multi-Family</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="stage">Initial Stage</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => setFormData({ ...formData, stage: value as LeadStage })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((stage) => (
                    <SelectItem key={stage.stage} value={stage.stage}>
                      {stage.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this lead..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? "Creating..." : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLeadDialog;

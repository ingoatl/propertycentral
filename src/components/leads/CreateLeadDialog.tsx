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
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { 
  createLeadSchema, 
  emailSchema, 
  phoneSchema, 
  nameSchema, 
  addressSchema,
  formatPhoneNumber,
  validateField 
} from "@/lib/validation";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPPORTUNITY_SOURCES = [
  "PeachHaus Discovery Call",
  "Realtor Referral",
  "Anja's Referral",
  "Website Inquiry",
  "Phone Call",
  "Email Inquiry",
  "Social Media",
  "Existing Owner Referral",
  "Agent Referral",
  "Friend/Family Referral",
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

  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string | null> = {};
    
    newErrors.name = validateField(nameSchema, formData.name);
    newErrors.email = validateField(emailSchema, formData.email);
    newErrors.phone = validateField(phoneSchema, formData.phone);
    newErrors.property_address = validateField(addressSchema, formData.property_address);
    
    if (!formData.opportunity_source) {
      newErrors.opportunity_source = "Please select an opportunity source";
    }
    if (!formData.property_type) {
      newErrors.property_type = "Please select a property type";
    }

    setErrors(newErrors);
    
    return !Object.values(newErrors).some(error => error !== null);
  };

  const createLead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.replace(/\D/g, ""), // Store digits only
          opportunity_source: formData.opportunity_source || null,
          opportunity_value: formData.opportunity_value ? parseFloat(formData.opportunity_value) : 0,
          property_address: formData.property_address.trim() || null,
          property_type: formData.property_type || null,
          stage: formData.stage as any,
          notes: formData.notes?.trim() || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: data.id,
        action: "Lead created",
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        new_stage: formData.stage as any,
      } as any);

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
      setErrors({});
    },
    onError: (error) => {
      toast.error("Failed to create lead: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }
    
    createLead.mutate();
  };

  const handlePhoneChange = (value: string) => {
    // Format as user types
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, phone: formatted });
    
    // Clear error on change
    if (errors.phone) {
      setErrors({ ...errors, phone: null });
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear error on change
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
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
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="John Smith"
                required
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                placeholder="john@example.com"
                required
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(555) 123-4567"
                required
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && (
                <p className="text-xs text-destructive mt-1">{errors.phone}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="source">Opportunity Source *</Label>
              <Select
                value={formData.opportunity_source}
                onValueChange={(value) => handleFieldChange("opportunity_source", value)}
              >
                <SelectTrigger className={errors.opportunity_source ? "border-destructive" : ""}>
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
              {errors.opportunity_source && (
                <p className="text-xs text-destructive mt-1">{errors.opportunity_source}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="value">Opportunity Value ($)</Label>
              <Input
                id="value"
                type="number"
                value={formData.opportunity_value}
                onChange={(e) => handleFieldChange("opportunity_value", e.target.value)}
                placeholder="0"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="address">Property Address *</Label>
              <AddressAutocomplete
                id="address"
                value={formData.property_address}
                onChange={(value) => handleFieldChange("property_address", value)}
                placeholder="Start typing an address..."
                required
                className={errors.property_address ? "border-destructive" : ""}
              />
              {errors.property_address && (
                <p className="text-xs text-destructive mt-1">{errors.property_address}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="type">Property Type *</Label>
              <Select
                value={formData.property_type}
                onValueChange={(value) => handleFieldChange("property_type", value)}
              >
                <SelectTrigger className={errors.property_type ? "border-destructive" : ""}>
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
              {errors.property_type && (
                <p className="text-xs text-destructive mt-1">{errors.property_type}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="stage">Initial Stage</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => handleFieldChange("stage", value)}
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
                onChange={(e) => handleFieldChange("notes", e.target.value)}
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

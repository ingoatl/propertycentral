import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { VENDOR_SPECIALTIES } from "@/types/maintenance";

interface AddVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AddVendorDialog = ({ open, onOpenChange, onSuccess }: AddVendorDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    specialty: [] as string[],
    hourly_rate: "",
    emergency_rate: "",
    emergency_available: false,
    license_number: "",
    insurance_verified: false,
    insurance_expiration: "",
    w9_on_file: false,
    preferred_payment_method: "",
    notes: "",
    status: "active" as const,
  });

  const createVendor = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("vendors").insert({
        name: formData.name,
        company_name: formData.company_name || null,
        email: formData.email || null,
        phone: formData.phone,
        specialty: formData.specialty,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        emergency_rate: formData.emergency_rate ? parseFloat(formData.emergency_rate) : null,
        emergency_available: formData.emergency_available,
        license_number: formData.license_number || null,
        insurance_verified: formData.insurance_verified,
        insurance_expiration: formData.insurance_expiration || null,
        w9_on_file: formData.w9_on_file,
        preferred_payment_method: formData.preferred_payment_method || null,
        notes: formData.notes || null,
        status: formData.status,
        created_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create vendor: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      company_name: "",
      email: "",
      phone: "",
      specialty: [],
      hourly_rate: "",
      emergency_rate: "",
      emergency_available: false,
      license_number: "",
      insurance_verified: false,
      insurance_expiration: "",
      w9_on_file: false,
      preferred_payment_method: "",
      notes: "",
      status: "active",
    });
  };

  const toggleSpecialty = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialty: prev.specialty.includes(specialty)
        ? prev.specialty.filter(s => s !== specialty)
        : [...prev.specialty, specialty],
    }));
  };

  const getSpecialtyLabel = (specialty: string) => {
    return specialty.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Vendor</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!formData.name || !formData.phone || formData.specialty.length === 0) {
              toast.error("Please fill in required fields");
              return;
            }
            createVendor.mutate();
          }}
          className="space-y-6"
        >
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Contact Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Smith Plumbing LLC"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@smithplumbing.com"
              />
            </div>
          </div>

          {/* Specialties */}
          <div className="space-y-2">
            <Label>Specialties * (select all that apply)</Label>
            <div className="flex flex-wrap gap-2">
              {VENDOR_SPECIALTIES.map((specialty) => (
                <Button
                  key={specialty}
                  type="button"
                  variant={formData.specialty.includes(specialty) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSpecialty(specialty)}
                >
                  {getSpecialtyLabel(specialty)}
                </Button>
              ))}
            </div>
          </div>

          {/* Rates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
              <Input
                id="hourly_rate"
                type="number"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder="75"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_rate">Emergency Rate ($)</Label>
              <Input
                id="emergency_rate"
                type="number"
                value={formData.emergency_rate}
                onChange={(e) => setFormData({ ...formData, emergency_rate: e.target.value })}
                placeholder="150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="preferred">Preferred</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Compliance */}
          <div className="space-y-4">
            <Label className="text-base">Compliance & Availability</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="emergency_available"
                  checked={formData.emergency_available}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, emergency_available: !!checked })
                  }
                />
                <Label htmlFor="emergency_available" className="font-normal">
                  Available for 24/7 emergencies
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="insurance_verified"
                  checked={formData.insurance_verified}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, insurance_verified: !!checked })
                  }
                />
                <Label htmlFor="insurance_verified" className="font-normal">
                  Insurance verified
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="w9_on_file"
                  checked={formData.w9_on_file}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, w9_on_file: !!checked })
                  }
                />
                <Label htmlFor="w9_on_file" className="font-normal">
                  W-9 on file
                </Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                placeholder="LIC-123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance_expiration">Insurance Expiration</Label>
              <Input
                id="insurance_expiration"
                type="date"
                value={formData.insurance_expiration}
                onChange={(e) => setFormData({ ...formData, insurance_expiration: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this vendor..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createVendor.isPending}>
              {createVendor.isPending ? "Adding..." : "Add Vendor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddVendorDialog;

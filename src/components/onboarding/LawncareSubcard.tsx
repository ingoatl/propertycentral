import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LawncareSubcardProps {
  projectId: string;
  onUpdate: () => void;
}

interface LawncareData {
  company_name: string;
  phone_number: string;
  schedule: string;
  payment: string;
}

export const LawncareSubcard = ({ projectId, onUpdate }: LawncareSubcardProps) => {
  const [data, setData] = useState<LawncareData>({
    company_name: "",
    phone_number: "",
    schedule: "",
    payment: ""
  });

  const autoSave = async (field: keyof LawncareData, value: string) => {
    const updatedData = { ...data, [field]: value };
    setData(updatedData);
    
    // Save to database or handle as needed
    // For now, we'll store this as JSON in notes or a custom field
    try {
      // You can customize this to save to a specific table or field
      console.log("Saving lawncare data:", updatedData);
      onUpdate();
    } catch (error) {
      console.error("Failed to save lawncare data:", error);
      toast.error("Failed to save");
    }
  };

  return (
    <Card className="mt-4 p-4 bg-muted/30 border-l-4 border-l-primary">
      <h4 className="text-sm font-semibold mb-4">Lawncare Details</h4>
      <div className="space-y-4">
        {/* Company Name */}
        <div>
          <Label htmlFor="lawncare-company" className="text-xs font-medium mb-1 block">
            Company Name
          </Label>
          <Input
            id="lawncare-company"
            value={data.company_name}
            onChange={(e) => autoSave('company_name', e.target.value)}
            placeholder="Enter company name..."
            className="h-9 text-sm"
          />
        </div>

        {/* Phone Number */}
        <div>
          <Label htmlFor="lawncare-phone" className="text-xs font-medium mb-1 block">
            Phone Number
          </Label>
          <Input
            id="lawncare-phone"
            type="tel"
            value={data.phone_number}
            onChange={(e) => autoSave('phone_number', e.target.value)}
            placeholder="(555) 123-4567"
            className="h-9 text-sm"
          />
        </div>

        {/* Schedule */}
        <div>
          <Label className="text-xs font-medium mb-2 block">Schedule</Label>
          <RadioGroup 
            value={data.schedule} 
            onValueChange={(value) => autoSave('schedule', value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Semi-Weekly" id="semi-weekly" />
              <Label htmlFor="semi-weekly" className="text-sm font-normal">Semi-Weekly</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Monthly" id="monthly" />
              <Label htmlFor="monthly" className="text-sm font-normal">Monthly</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Negotiated Payment */}
        <div>
          <Label htmlFor="lawncare-payment" className="text-xs font-medium mb-1 block">
            Negotiated Payment
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="lawncare-payment"
              type="number"
              step="0.01"
              value={data.payment}
              onChange={(e) => autoSave('payment', e.target.value)}
              placeholder="0.00"
              className="pl-7 h-9 text-sm"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
